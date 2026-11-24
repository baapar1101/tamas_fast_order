import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { safeStorageKey, storage } from '../services/storage/index.js';

/**
 * /uploads/<key> when files live in object storage: the bucket stays private
 * and the API streams public files from it (falling back to the old disk
 * folder for anything not copied yet). The guardLegacyUpload hook still runs
 * first, so private documents never come out of this route.
 */
export function registerBucketUploads(app: FastifyInstance): void {
  const prefix = `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/`;
  app.route({
    method: ['GET', 'HEAD'],
    url: `${prefix}*`,
    handler: async (req, reply) => {
      const raw = (req.params as { '*': string })['*'] ?? '';
      let key: string | null;
      try {
        key = safeStorageKey(decodeURIComponent(raw));
      } catch {
        key = null;
      }
      if (!key || key.startsWith('private/') || key.startsWith('backups/')) {
        return reply.code(404).send({ ok: false, code: 'not_found' });
      }
      const object = await storage.get(key);
      if (!object) return reply.code(404).send({ ok: false, code: 'not_found' });

      // Upload keys are content-unique (a new upload gets a new name).
      reply.header('Cache-Control', 'public, max-age=2592000, immutable');
      if (object.etag) reply.header('ETag', object.etag);
      if (object.lastModified) reply.header('Last-Modified', object.lastModified.toUTCString());
      if (object.etag && req.headers['if-none-match'] === object.etag) {
        object.stream.destroy();
        return reply.code(304).send();
      }
      reply.type(object.contentType);
      if (object.size) reply.header('Content-Length', object.size);
      if (req.method === 'HEAD') {
        object.stream.destroy();
        return reply.send();
      }
      return reply.send(object.stream);
    },
  });
}
