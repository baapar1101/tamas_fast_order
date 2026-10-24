import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { nativeDeviceSchema } from '../lib/native-push.js';
import { badRequest } from '../lib/errors.js';
import * as service from '../services/native-push.js';
export function createNativeRoutes(deps = service): FastifyPluginAsync {
  return async app => {
    app.get('/native/config', async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
      return { ok: true, pushEnabled: await deps.nativePushEnabled(), minimumVersion: '1.0.0' };
    });
    app.post('/native/push-devices', { preHandler: [app.requireUser], config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async req => {
      const body = nativeDeviceSchema.parse(req.body);
      if (!req.sessionToken) throw badRequest('نشست ورود معتبر نیست.');
      await deps.registerNativeDevice(req.currentUser!.id, req.sessionToken, body);
      return { ok: true };
    });
    app.delete('/native/push-devices', { preHandler: [app.requireUser] }, async req => {
      const { installationId } = z.object({ installationId: z.string().uuid() }).strict().parse(req.body);
      await deps.removeNativeDevice(req.currentUser!.id, installationId);
      return { ok: true };
    });
  };
}
export default createNativeRoutes();
