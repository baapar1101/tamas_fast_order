import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isValidPhone, normalizePhone } from '@tamas/shared';
import { badRequest } from '../../lib/errors.js';
import { sendSms } from '../../services/sms.js';

const testSchema = z.object({
  phone: z.string().min(1).max(20),
  templateKey: z.string().min(1).max(120),
  text: z.string().min(1).max(4000),
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