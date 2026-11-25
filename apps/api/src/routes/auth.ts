import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import {
  isValidPhone,
  normalizePhone,
  otpRequestSchema,
  otpVerifySchema,
  passwordLoginSchema,
  profileWriteSchema,
  setPasswordSchema,
} from '@tamas/shared';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { adminPhones, env } from '../env.js';
import { adminCredentialsMatch, adminLoginEnabled } from '../lib/admin-login.js';
import { logAction } from '../services/audit.js';
import { setBrowserSession } from '../plugins/auth.js';
import { AppError, badRequest } from '../lib/errors.js';
import { createSession, destroySession, missingProfileFields, findOrCreateUser, toUserDTO } from '../services/auth.js';
import { resendCooldown, sendOtp, verifyOtp } from '../services/otp.js';
import { saveCustomerProfile, verifyCustomerIdentity } from '../services/customer-profile.js';
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
    async (req, reply) => {
      const { phone, code } = otpVerifySchema.parse(req.body);
      const verified = await verifyOtp(phone, code);
      if (!verified) throw badRequest('کد وارد شده صحیح نیست یا منقضی شده است.');

      const { row, isNew } = await findOrCreateUser(phone);
      const token = await createSession(row.id, { ip: req.ip, userAgent: req.headers['user-agent'] });
      setBrowserSession(reply, token);
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
    async (req, reply) => {
      const { phone, password } = passwordLoginSchema.parse(req.body);
      const user = await db.query.users.findFirst({
        where: eq(users.phone, phone),
      });

      if (!user) throw badRequest('کاربری با این شماره یافت نشد.');
      if (!user.passwordHash) throw badRequest('رمز عبور برای این کاربر تنظیم نشده است. لطفاً با کد یکبار مصرف وارد شوید.');
      
      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) throw badRequest('رمز عبور اشتباه است.');

      const token = await createSession(user.id, { ip: req.ip, userAgent: req.headers['user-agent'] });
      setBrowserSession(reply, token);
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

  /** Whether the admin panel should offer the environment username/password form. */
  app.get('/auth/admin/login', async () => ({
    ok: true,
    enabled: adminLoginEnabled({ username: env.ADMIN_LOGIN_USERNAME, password: env.ADMIN_LOGIN_PASSWORD }),
  }));

  /**
   * Admin sign-in with ADMIN_LOGIN_USERNAME / ADMIN_LOGIN_PASSWORD from the
   * environment, for when SMS codes cannot be delivered. Signs in as the
   * admin account of ADMIN_LOGIN_PHONE (else the first ADMIN_PHONES number,
   * else the oldest admin) and makes sure that account is an active admin.
   */
  app.post(
    '/auth/admin/login',
    { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const config = { username: env.ADMIN_LOGIN_USERNAME, password: env.ADMIN_LOGIN_PASSWORD };
      if (!adminLoginEnabled(config)) {
        throw new AppError('ورود مدیر با نام کاربری و رمز فعال نیست.', 404, 'not_enabled');
      }
      const body = z.object({ username: z.string().max(200), password: z.string().max(500) }).parse(req.body);
      if (!adminCredentialsMatch(config, body.username, body.password)) {
        req.log.warn({ ip: req.ip }, 'admin password login rejected');
        throw badRequest('نام کاربری یا رمز عبور اشتباه است.');
      }

      const phoneSource = env.ADMIN_LOGIN_PHONE || adminPhones[0] || '';
      let account: typeof users.$inferSelect | undefined;
      if (phoneSource) {
        const phone = normalizePhone(phoneSource);
        if (!isValidPhone(phone)) throw badRequest('شمارهٔ ADMIN_LOGIN_PHONE معتبر نیست.');
        account = (await findOrCreateUser(phone)).row;
      } else {
        [account] = await db.select().from(users)
          .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
          .orderBy(asc(users.id))
          .limit(1);
      }
      if (!account) throw badRequest('حساب مدیر پیدا نشد؛ ADMIN_LOGIN_PHONE را تنظیم کنید.');
      if (account.role !== 'admin' || !account.isActive || account.deletedAt) {
        [account] = await db.update(users)
          .set({ role: 'admin', isActive: true, deletedAt: null, updatedAt: new Date() })
          .where(eq(users.id, account.id))
          .returning();
      }
      if (!account) throw badRequest('حساب مدیر پیدا نشد.');

      const token = await createSession(account.id, { ip: req.ip, userAgent: req.headers['user-agent'] });
      setBrowserSession(reply, token);
      await logAction(account.id, 'ADMIN_PASSWORD_LOGIN', 'user', String(account.id), { ip: req.ip });
      const missing = missingProfileFields(account);
      return { ok: true, token, user: toUserDTO(account), isNew: false, complete: missing.length === 0, missing };
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
    return saveCustomerProfile(req.currentUser!, body, req.log);
  });

  app.post('/auth/inquiry-identity', { preHandler: [app.requireUser] }, async (req) => {
    const { national_code, birth_date } = req.body as { national_code?: string; birth_date?: string };
    return verifyCustomerIdentity(req.currentUser!, national_code, birth_date, req.log);
  });

  app.post('/auth/logout', async (req, reply) => {
    await destroySession(req.sessionToken ?? undefined);
    reply.clearCookie('tamas_session', { path: '/' });
    return { ok: true, message: 'از حساب خود خارج شدید.' };
  });
};

export default routes;
