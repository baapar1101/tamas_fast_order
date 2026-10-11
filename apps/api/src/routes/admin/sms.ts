import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isValidPhone, normalizePhone } from '@tamas/shared';
import { badRequest } from '../../lib/errors.js';
import { sendSms, testSmsProvider } from '../../services/sms.js';
import {
  getSmsRuntimeConfig,
  smsConfigForAdmin,
  updateSmsRuntimeConfig,
} from '../../services/sms-config.js';

const testSchema = z.object({
  phone: z.string().min(1).max(20),
  templateKey: z.string().min(1).max(120),
  text: z.string().min(1).max(4000),
});

const providerConfigSchema = z.object({
  smsProvider: z.enum(['rastin', 'payamresan', 'melipayamak']).optional(),
  firstFallback: z.enum(['none', 'melipayamak']).optional(),
  secondFallback: z.enum(['none', 'smsir']).optional(),
  rastinUsername: z.string().max(300).optional(),
  rastinPassword: z.string().max(500).optional(),
  rastinSender: z.string().max(100).optional(),
  rastinUrl: z.string().url().max(1000).optional(),
  payamresanApiKey: z.string().max(500).optional(),
  payamresanSender: z.string().max(100).optional(),
  payamresanBaseUrl: z.string().url().max(1000).optional(),
  melipayamakUsername: z.string().max(300).optional(),
  melipayamakApiKey: z.string().max(500).optional(),
  melipayamakSender: z.string().max(100).optional(),
  melipayamakBaseUrl: z.string().url().max(1000).optional(),
  smsirApiKey: z.string().max(500).optional(),
  smsirLineNumber: z.string().max(100).optional(),
  smsirBaseUrl: z.string().url().max(1000).optional(),
  smsirOtpTemplateId: z.string().max(100).optional(),
  smsirOtpParameter: z.string().max(100).optional(),
});

const providerTestSchema = z.object({
  phone: z.string().min(1).max(20),
  provider: z.enum(['rastin', 'payamresan', 'melipayamak', 'smsir', 'chain']),
});

/**
 * Sample values stand in for the {variable} placeholders so a test message
 * reads naturally before the real event fires.
 */
const SAMPLE_VARS: Record<string, string> = {
  name: 'مشتری نمونه',
  order_code: 'KP-1401-0912-3344-567',
  status: 'ارسال شده',
  code: '12345',
};

export const smsRoutes: FastifyPluginAsync = async (app) => {
  // Configuring the smart SMS templates is part of the panel settings.
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/sms/providers', async () => ({
    ok: true,
    config: smsConfigForAdmin(await getSmsRuntimeConfig()),
  }));

  app.put('/admin/sms/providers', async (req) => {
    const body = providerConfigSchema.parse(req.body);
    await updateSmsRuntimeConfig(body);
    return {
      ok: true,
      config: smsConfigForAdmin(await getSmsRuntimeConfig()),
      message: 'تنظیمات درگاه‌های پیامک ذخیره شد.',
    };
  });

  app.post('/admin/sms/providers/test', async (req) => {
    const body = providerTestSchema.parse(req.body);
    const phone = normalizePhone(body.phone);
    if (!isValidPhone(phone)) throw badRequest('شماره همراه معتبر وارد کنید.');
    const result = await testSmsProvider(
      body.provider,
      phone,
      `تست درگاه پیامک تماس مارکت (${body.provider})`,
    );
    if (!result.ok) throw badRequest(result.error || 'تست درگاه پیامک ناموفق بود.');
    return { ok: true, message: 'پیامک تست با موفقیت پذیرفته شد.' };
  });

  app.post('/admin/sms/test', async (req) => {
    const body = testSchema.parse(req.body);
    const phone = normalizePhone(body.phone);
    if (!isValidPhone(phone)) throw badRequest('شماره همراه معتبر وارد کنید.');

    let text = body.text;
    for (const [key, value] of Object.entries(SAMPLE_VARS)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    const result = await sendSms(phone, text);
    if (!result.ok) throw badRequest(result.error || 'ارسال پیامک تست ناموفق بود.');
    return { ok: true };
  });
};

export default smsRoutes;
