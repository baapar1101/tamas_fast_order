import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { normalizeLandline, otpRequestSchema, otpVerifySchema, profileWriteSchema, passwordLoginSchema, setPasswordSchema, type UserDTO } from '@tamas/shared';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { env } from '../env.js';
import { badRequest } from '../lib/errors.js';
import { createSession, destroySession, missingProfileFields, findOrCreateUser, toUserDTO } from '../services/auth.js';
import { resendCooldown, sendOtp, verifyOtp } from '../services/otp.js';
import { crmClient } from '../lib/crm.js';
import { hashPassword, verifyPassword } from '../lib/hash.js';

/**
 * The whole point of this file: verification now happens on the server. The
 * legacy build checked the OTP in the browser and then asked the backend for a
 * session, so anyone could POST a phone number and be logged in as that shop.
 */
const routes: FastifyPluginAsync = async (app) => {
  app.post(
    '/auth/otp/request',
    { config: { rateLimit: { max: 12, timeWindow: '10 minutes' } } },
    async (req) => {
      const { phone } = otpRequestSchema.parse(req.body);
      const result = await sendOtp(phone, req.ip);
      return {
        ok: true,
        resendAfter: env.OTP_RESEND_SECONDS,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      };
    },
  );

  app.get('/auth/otp/cooldown', async (req) => {
    const { phone } = otpRequestSchema.parse(req.query);
    return { ok: true, seconds: await resendCooldown(phone) };
  });

  app.post(
    '/auth/otp/verify',
    { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (req) => {
      const { phone, code } = otpVerifySchema.parse(req.body);
      const verified = await verifyOtp(phone, code);
      if (!verified) throw badRequest('کد وارد شده صحیح نیست یا منقضی شده است.');

      const { row, isNew } = await findOrCreateUser(phone);
      const token = await createSession(row.id, { ip: req.ip, userAgent: req.headers['user-agent'] });
      const missing = missingProfileFields(row);

      return {
        ok: true,
        token,
        user: toUserDTO(row),
        isNew,
        complete: missing.length === 0,
        missing,
      };
    },
  );

  app.post(
    '/auth/password/login',
    { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (req) => {
      const { phone, password } = passwordLoginSchema.parse(req.body);
      const user = await db.query.users.findFirst({
        where: eq(users.phone, phone),
      });

      if (!user) throw badRequest('کاربری با این شماره یافت نشد.');
      if (!user.passwordHash) throw badRequest('رمز عبور برای این کاربر تنظیم نشده است. لطفاً با کد یکبار مصرف وارد شوید.');
      
      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) throw badRequest('رمز عبور اشتباه است.');

      const token = await createSession(user.id, { ip: req.ip, userAgent: req.headers['user-agent'] });
      const missing = missingProfileFields(user);

      return {
        ok: true,
        token,
        user: toUserDTO(user),
        isNew: false,
        complete: missing.length === 0,
        missing,
      };
    },
  );

  app.post(
    '/auth/password/set',
    { preHandler: [app.requireUser] },
    async (req) => {
      const { oldPassword, newPassword } = setPasswordSchema.parse(req.body);
      const current = req.currentUser!;

      if (current.passwordHash) {
        if (!oldPassword) throw badRequest('برای تغییر رمز عبور، وارد کردن رمز عبور فعلی الزامی است.');
        const isValid = verifyPassword(oldPassword, current.passwordHash);
        if (!isValid) throw badRequest('رمز عبور فعلی اشتباه است.');
      }

      const newHash = hashPassword(newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, current.id));

      return { ok: true, message: 'رمز عبور با موفقیت تنظیم شد.' };
    },
  );

  app.get('/auth/me', { preHandler: [app.requireUser] }, async (req) => {
    const row = req.currentUser!;
    const missing = missingProfileFields(row);
    return { ok: true, user: toUserDTO(row), complete: missing.length === 0, missing };
  });

  app.put('/auth/profile', { preHandler: [app.requireUser] }, async (req) => {
    const body = profileWriteSchema.parse(req.body);
    const current = req.currentUser!;

    let updatedUser: UserDTO;
    try {
      const [updated] = await db
              .update(users)
              .set({
                name: body.name,
                lastName: body.lastName,
                storeName: body.storeName,
                landline: normalizeLandline(body.landline),
                address: body.address,
                postalCode: normalizeLandline(body.postalCode),
                certificateFileUrl: body.certificateFileUrl,
                updatedAt: new Date(),
              })
              .where(eq(users.id, current.id))
              .returning();
            updatedUser = toUserDTO(updated || current);

            // Fire-and-forget CRM person sync on profile update
            const { getCrmConfig } = await import('../services/settings.js');
            getCrmConfig().then(config => crmClient.pushPerson({
              firstName: body.name ?? '',
              lastName: body.lastName ?? '',
              phone: current.phone,
              email: `${current.phone}@tamas.local`,
              aliasName: `${body.name ?? ''} ${body.lastName ?? ''}`.trim() || current.phone,
            }, config)).catch((err: unknown) => {
                          // CRM sync failure shouldn't block profile update
                        });
    } catch {
      current.name = body.name;
      current.lastName = body.lastName;
      current.storeName = body.storeName;
      current.landline = normalizeLandline(body.landline);
      current.address = body.address;
      current.postalCode = normalizeLandline(body.postalCode);
      current.certificateFileUrl = body.certificateFileUrl;
      updatedUser = toUserDTO(current);
    }

    const missing = missingProfileFields({
      ...current,
      name: updatedUser.name,
      lastName: updatedUser.lastName,
      storeName: updatedUser.storeName,
      address: updatedUser.address,
    });

    const { sendTelegramNotification } = await import('../services/telegram.js');
    void sendTelegramNotification('user.profile_updated', {
      title: missing.length === 0 ? '👤 پروفایل کاربر تکمیل شد' : '👤 پروفایل کاربر ویرایش شد',
      fields: [
        { label: 'نام', value: `${updatedUser.name} ${updatedUser.lastName}`.trim() },
        { label: 'فروشگاه', value: updatedUser.storeName },
        { label: 'تلفن', value: updatedUser.phone },
        { label: 'وضعیت پروفایل', value: missing.length === 0 ? 'کامل' : 'ناقص' },
      ],
    }).catch((err) => req.log.error({ err }, 'failed to send Telegram profile notification'));

    return {
      ok: true,
      user: updatedUser,
      complete: missing.length === 0,
      missing,
      message: 'اطلاعات شما ذخیره شد.',
    };
  });

  app.post('/auth/inquiry-identity', { preHandler: [app.requireUser] }, async (req) => {
    const { national_code, birth_date } = req.body as { national_code?: string; birth_date?: string };
    const cleanNationalCode = String(national_code || '').trim();
    const cleanBirthDate = String(birth_date || '').trim();

    if (!cleanNationalCode || !cleanBirthDate) {
      throw badRequest('کد ملی و تاریخ تولد (شمسی) برای استعلام الزامی است.');
    }

    try {
      const response = await fetch(
        'https://service.zohal.io/api/v0/services/inquiry/national_identity_inquiry',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 0c23148ee07366592d9fc19dd8bb1528c2a0f1bb',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            national_code: cleanNationalCode,
            birth_date: cleanBirthDate,
          }),
        },
      );

      if (!response.ok) {
        throw badRequest(`ارتباط با سامانه استعلام هویتی ناموفق بود (${response.status})`);
      }

      const resData = await response.json();
      const firstItem = Array.isArray(resData) ? resData[0] : resData;
      const inquiryBody = firstItem?.data?.result?.response_body?.data;

      if (!inquiryBody || !inquiryBody.matched) {
        throw badRequest('اطلاعات هویتی با کد ملی و تاریخ تولد واردشده مطابقت ندارد.');
      }

      if (inquiryBody.is_dead || inquiryBody.alive === false) {
        throw badRequest('امکان استعلام و تایید برای این کد ملی وجود ندارد.');
      }

      // 2. Bounced Cheque Inquiry
      const chequeResponse = await fetch(
        'https://service.zohal.io/api/v0/services/inquiry/bounced_cheque',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer 0c23148ee07366592d9fc19dd8bb1528c2a0f1bb',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            national_code: cleanNationalCode,
            nationality_type: 1,
          }),
        },
      );

      if (!chequeResponse.ok) {
        throw badRequest(`ارتباط با سامانه استعلام چک برگشتی ناموفق بود (${chequeResponse.status})`);
      }

      const chequeData = await chequeResponse.json();
      const chequeFirst = Array.isArray(chequeData) ? chequeData[0] : chequeData;
      // Zohal payload might be nested depending on gateway wrapping
      const chequeCount = chequeFirst?.response_body?.data?.count ?? chequeFirst?.data?.result?.response_body?.data?.count ?? 0;

      if (chequeCount > 0) {
        throw badRequest(`کد ملی وارد شده دارای ${chequeCount} چک برگشتی است و امکان تأیید حساب وجود ندارد.`);
      }

      const current = req.currentUser!;
      let updatedUser: UserDTO;
      try {
        const [updated] = await db
                  .update(users)
                  .set({
                    name: inquiryBody.first_name || current.name,
                    lastName: inquiryBody.last_name || current.lastName,
                    fatherName: inquiryBody.father_name || '',
                    nationalCode: cleanNationalCode,
                    birthDate: cleanBirthDate,
                    isVerifiedIdentity: true,
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, current.id))
                  .returning();
                updatedUser = toUserDTO(updated || current);

                // Fire-and-forget CRM person sync after identity verification
                const { getCrmConfig } = await import('../services/settings.js');
                getCrmConfig().then(config => crmClient.pushPerson({
                  firstName: inquiryBody.first_name || current.name,
                  lastName: inquiryBody.last_name || current.lastName,
                  phone: current.phone,
                  email: `${current.phone}@tamas.local`,
                  aliasName: `${inquiryBody.first_name || current.name} ${inquiryBody.last_name || current.lastName}`.trim() || current.phone,
                }, config)).catch((err: unknown) => {
                  // CRM sync failure shouldn't block identity verification
                });
      } catch {
        current.name = inquiryBody.first_name || current.name;
        current.lastName = inquiryBody.last_name || current.lastName;
        current.fatherName = inquiryBody.father_name || '';
        current.nationalCode = cleanNationalCode;
        current.birthDate = cleanBirthDate;
        current.isVerifiedIdentity = true;
        updatedUser = toUserDTO(current);
      }

      const missing = missingProfileFields({
        ...current,
        name: updatedUser.name,
        lastName: updatedUser.lastName,
        storeName: updatedUser.storeName,
        address: updatedUser.address,
      });

      return {
        ok: true,
        message: 'استعلام اطلاعات هویتی با موفقیت انجام شد.',
        user: updatedUser,
        complete: missing.length === 0,
        missing,
        identity: {
          matched: true,
          firstName: inquiryBody.first_name,
          lastName: inquiryBody.last_name,
          fatherName: inquiryBody.father_name,
          nationalCode: inquiryBody.national_code,
          alive: inquiryBody.alive,
        },
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes('استعلام')) throw err;
      throw badRequest(err instanceof Error ? err.message : 'خطایی در فرآیند استعلام رخ داد.');
    }
  });

  app.post('/auth/logout', async (req, reply) => {
    await destroySession(req.sessionToken ?? undefined);
    reply.clearCookie('tamas_session', { path: '/' });
    return { ok: true, message: 'از حساب خود خارج شدید.' };
  });
};

export default routes;
