import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { normalizeLandline, otpRequestSchema, otpVerifySchema, profileWriteSchema } from '@tamas/shared';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { env } from '../env.js';
import { badRequest } from '../lib/errors.js';
import { createSession, destroySession, missingProfileFields, findOrCreateUser, toUserDTO } from '../services/auth.js';
import { resendCooldown, sendOtp, verifyOtp } from '../services/otp.js';

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

  app.get('/auth/me', { preHandler: [app.requireUser] }, async (req) => {
    const row = req.currentUser!;
    const missing = missingProfileFields(row);
    return { ok: true, user: toUserDTO(row), complete: missing.length === 0, missing };
  });

  app.put('/auth/profile', { preHandler: [app.requireUser] }, async (req) => {
    const body = profileWriteSchema.parse(req.body);
    const current = req.currentUser!;

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

    if (!updated) throw badRequest('ذخیره اطلاعات ناموفق بود.');
    const missing = missingProfileFields(updated);
    return {
      ok: true,
      user: toUserDTO(updated),
      complete: missing.length === 0,
      missing,
      message: 'اطلاعات شما ذخیره شد.',
    };
  });

  app.post('/auth/logout', async (req) => {
    await destroySession(req.sessionToken ?? undefined);
    return { ok: true, message: 'از حساب خود خارج شدید.' };
  });
};

export default routes;
