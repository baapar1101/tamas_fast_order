import { count, desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { UPLOAD_KINDS, uploadQuerySchema, type UploadKind } from '@tamas/shared';
import { db } from '../../db/client.js';
import { uploads } from '../../db/schema.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import { deleteUpload, processUpload, toUploadDTO } from '../../services/uploads.js';
import { logAction } from '../../services/audit.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_content'));

  /**
   * Multipart, one or many files per request, so the panel can drop a whole
   * folder of product shots in at once.
   */
  app.post('/admin/uploads', async (req) => {
    if (!req.isMultipart()) throw badRequest('درخواست باید از نوع multipart باشد.');

    const results = [];
    let kind: UploadKind = 'other';

    for await (const part of req.parts()) {
      if (part.type === 'field' && part.fieldname === 'kind') {
        const value = String(part.value);
        if ((UPLOAD_KINDS as readonly string[]).includes(value)) kind = value as UploadKind;
        continue;
      }
      if (part.type !== 'file') continue;

      const buffer = await part.toBuffer();
      results.push(
        await processUpload({
          buffer,
          filename: part.filename || 'file',
          mimeType: part.mimetype,
          kind,
          uploadedBy: req.currentUser!.id,
        }),
      );
    }

    if (results.length === 0) throw badRequest('فایلی دریافت نشد.');
    await logAction(req.currentUser!.id, 'upload', 'file', null, { count: results.length, kind });
    return { ok: true, uploads: results, message: `${results.length} فایل آپلود شد.` };
  });

  app.get('/admin/uploads', async (req) => {
    const q = uploadQuerySchema.parse(req.query);
    const where = q.kind ? eq(uploads.kind, q.kind) : undefined;

    const [rows, [total]] = await Promise.all([
      db.select().from(uploads).where(where).orderBy(desc(uploads.createdAt)).limit(q.perPage).offset(offsetOf(q)),
      db.select({ n: count() }).from(uploads).where(where),
    ]);

    return {
      ok: true,
      items: rows.map(toUploadDTO),
      total: Number(total?.n ?? 0),
      page: q.page,
      perPage: q.perPage,
    };
  });

  app.delete('/admin/uploads/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const removed = await deleteUpload(id);
    if (!removed) throw notFound('فایل پیدا نشد.');
    await logAction(req.currentUser!.id, 'delete', 'file', String(id));
    return { ok: true, message: 'فایل حذف شد.' };
  });
};

export default routes;
