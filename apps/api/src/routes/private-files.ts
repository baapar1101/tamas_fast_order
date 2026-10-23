import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { canReadPrivateFile, privateFileUrl } from '../lib/private-files.js';
import { notFound } from '../lib/errors.js';
import { findPrivateFile, findUploadByKey, localUploadKey } from '../services/private-files.js';
import { openPrivateFile } from '../services/private-storage.js';
import { logAction } from '../services/audit.js';

export function privateFileHeaders(reply: FastifyReply) {
  reply.header('Cache-Control', 'private, no-store, max-age=0');
  reply.header('Pragma', 'no-cache');
  reply.header('Vary', 'Cookie, Authorization');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Cross-Origin-Resource-Policy', 'same-origin');
  reply.header('Referrer-Policy', 'no-referrer');
}

export function createPrivateFileRoutes(deps = { find: findPrivateFile, open: openPrivateFile, audit: logAction }): FastifyPluginAsync {
  return async (app) => {
    app.addHook('onRequest', async (_req, reply) => { privateFileHeaders(reply); });
    app.get('/files/:id', { preHandler: [app.requireUser] }, async (req, reply) => {
      const { id } = z.object({ id: z.coerce.number().int().positive().safe() }).parse(req.params);
      const { variant } = z.object({ variant: z.enum(['thumb']).optional() }).parse(req.query);
      const file = await deps.find(id);
      if (!file || !canReadPrivateFile(req.currentUser!, file)) throw notFound();
      const key = variant === 'thumb' ? file.thumbKey : file.storageKey;
      if (!key) throw notFound();
      let opened;
      try { opened = await deps.open(key); } catch { throw notFound('فایل در دسترس نیست؛ با پشتیبانی تماس بگیرید.'); }
      const mime = variant === 'thumb' ? 'image/webp' : file.mimeType;
      const safeInline = ['application/pdf', 'image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/avif'].includes(mime);
      reply.type(safeInline ? mime : 'application/octet-stream');
      reply.header('Content-Length', opened.size);
      reply.header('Content-Disposition', `${safeInline ? 'inline' : 'attachment'}; filename="document-${id}${mime === 'application/pdf' ? '.pdf' : ''}"`);
      await deps.audit(req.currentUser!.id, 'read', 'private_document', String(id), { scope: file.privateScope, thumbnail: variant === 'thumb' });
      return reply.send(opened.stream);
    });
  };
}

/** Backward-compatible, authenticated redirect for links cached before migration. */
export async function guardLegacyUpload(req: FastifyRequest, reply: FastifyReply) {
  const key = localUploadKey(req.url);
  if (key === null) return;
  const file = await findUploadByKey(key);
  if (file?.privateScope) {
    privateFileHeaders(reply);
    if (!req.currentUser || !canReadPrivateFile(req.currentUser, file)) return reply.code(404).send({ ok: false, code: 'not_found' });
    return reply.redirect(privateFileUrl(file.id, key === file.thumbKey));
  }
  // Certificates are always private, including unindexed legacy/orphan files.
  if (key.startsWith('certificate/') || key.includes('..') || key.includes('\\')) {
    privateFileHeaders(reply);
    return reply.code(404).send({ ok: false, code: 'not_found' });
  }
}

export default createPrivateFileRoutes();
