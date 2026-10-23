import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as service from '../services/document-recovery.js';

const idSchema = z.object({ id: z.coerce.number().int().positive().safe() });
const requestSchema = z.object({
  uploadId: z.number().int().positive().safe(), message: z.string().trim().min(5).max(2000),
  notifySms: z.boolean().default(false), notifyBots: z.boolean().default(false),
});
const reviewSchema = z.object({ action: z.enum(['approve', 'reject', 'cancel']), note: z.string().trim().max(2000).default('') })
  .refine((body) => body.action !== 'reject' || body.note.length >= 3, { message: 'علت رد مدرک را بنویسید.' });

export function createDocumentRecoveryRoutes(deps = service): FastifyPluginAsync {
  return async (app) => {
    app.addHook('onRequest', async (_req, reply) => {
      reply.header('Cache-Control', 'private, no-store'); reply.header('Vary', 'Cookie, Authorization');
    });
    app.get('/admin/document-health', { preHandler: [app.requirePermission('manage_users')] }, async () => ({ ok: true, items: await deps.documentHealth() }));
    app.post('/admin/document-requests', { preHandler: [app.requirePermission('manage_users')] }, async (req) => {
      const body = requestSchema.parse(req.body);
      const request = await deps.requestDocumentReupload(body.uploadId, req.currentUser!.id, body.message);
      const delivery = await deps.notifyDocumentRequest(request.id, { sms: body.notifySms, bots: body.notifyBots });
      return { ok: true, requestId: request.id, delivery, message: 'درخواست در حساب صاحب مدرک ثبت شد.' };
    });
    app.patch('/admin/document-requests/:id', { preHandler: [app.requirePermission('manage_users')] }, async (req) => {
      const { id } = idSchema.parse(req.params); const body = reviewSchema.parse(req.body);
      await deps.reviewDocumentReplacement(id, req.currentUser!.id, body.action, body.note);
      return { ok: true, message: body.action === 'approve' ? 'مدرک تأیید و ارجاع‌های فعلی جایگزین شد؛ تاریخچه محفوظ است.' : body.action === 'reject' ? 'علت رد ثبت شد؛ مشتری می‌تواند دوباره بارگذاری کند.' : 'درخواست لغو شد.' };
    });
    app.get('/document-requests', { preHandler: [app.requireUser] }, async (req) => ({ ok: true, items: await deps.listDocumentRequests(req.currentUser!.id) }));
    app.post('/document-requests/:id/submit', { preHandler: [app.requireUser] }, async (req) => {
      const { id } = idSchema.parse(req.params); const { fileUrl } = z.object({ fileUrl: z.string().max(1000) }).parse(req.body);
      await deps.submitDocumentReplacement(id, req.currentUser!.id, fileUrl);
      return { ok: true, message: 'مدرک دریافت شد و پس از بررسی مدیر جایگزین می‌شود.' };
    });
  };
}
export default createDocumentRecoveryRoutes();
