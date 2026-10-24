import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { nativeDeviceSchema } from '../lib/native-push.js';
import { badRequest } from '../lib/errors.js';
import * as service from '../services/native-push.js';
import { uploadNativeAttachment } from '../services/native-uploads.js';
const defaults={nativePushEnabled:service.nativePushEnabled,registerNativeDevice:service.registerNativeDevice,removeNativeDevice:service.removeNativeDevice,uploadNativeAttachment};
export function createNativeRoutes(deps = defaults): FastifyPluginAsync {
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
    app.post('/native/uploads',{preHandler:[app.requireUser],config:{rateLimit:{max:20,timeWindow:'10 minutes'}}},async req=>{
      if(!req.isMultipart())throw badRequest('فایل باید با فرمت multipart ارسال شود.');
      let file:{buffer:Buffer;filename:string;mimeType:string}|undefined;
      const fields:Record<string,string>={};
      for await(const part of req.parts({limits:{files:1}})){
        if(part.type==='field'){fields[part.fieldname]=String(part.value);continue;}
        file={buffer:await part.toBuffer(),filename:part.filename||'attachment',mimeType:part.mimetype};
      }
      if(!file)throw badRequest('فایل دریافت نشد.');
      const meta=z.object({scope:z.enum(['credit','payment']),documentRequestId:z.coerce.number().int().positive().optional()}).parse(fields);
      const uploaded=await deps.uploadNativeAttachment({...file,...meta,ownerId:req.currentUser!.id});
      return {ok:true,url:uploaded.url};
    });
  };
}
export default createNativeRoutes();
