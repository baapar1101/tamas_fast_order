import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { logAction } from '../../services/audit.js';
import { getInboxService, listInboxMessages, pollSmsInbox, setInboxHandled } from '../../services/sms-inbox.js';

const listQuery = z.object({
  q: z.string().trim().max(80).default(''),
  status: z.enum(['all', 'open', 'handled']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

/** Received SMS (Payam Resan inbox). The provider key never leaves the server. */
export const smsInboxRoutes: FastifyPluginAsync = async (app) => {
  // Same permission as the rest of the admin SMS section.
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/sms/inbox', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const query = listQuery.parse(req.query);
    return { ok: true, ...await listInboxMessages({ ...query, perPage: 25 }) };
  });

  app.post('/admin/sms/inbox/:id/handled', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
    const { handled } = z.object({ handled: z.boolean() }).strict().parse(req.body);
    await setInboxHandled(id, handled, req.currentUser!.id);
    await logAction(req.currentUser!.id, handled ? 'handle' : 'reopen', 'sms_inbox', String(id));
    return { ok: true };
  });

  /** Pull the provider inbox now instead of waiting for the next scheduled pass. */
  app.post('/admin/sms/inbox/sync', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async () => {
    const report = await pollSmsInbox();
    const message = report.skipped === 'not_configured'
      ? 'کلید API پیام‌رسان تنظیم نشده است؛ پیامکی دریافت نشد.'
      : report.skipped === 'running'
        ? 'دریافت پیامک‌ها در حال انجام است.'
        : report.stored > 0
          ? `${report.stored.toLocaleString('fa-IR')} پیامک تازه دریافت شد.`
          : 'پیامک تازه‌ای نبود.';
    return { ok: true, ...report, message };
  });

  /** Credit and receiving lines, so the admin can check the account is wired up. */
  app.get('/admin/sms/inbox/account', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async () => {
    const service = await getInboxService();
    if (!service.configured) return { ok: true, configured: false, account: null };
    return { ok: true, configured: true, account: await service.getAccountInfo() };
  });
};

export default smsInboxRoutes;
