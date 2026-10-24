import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { nativeDeviceSchema, nativeMessage } from '../src/lib/native-push.js';
import { createNativeRoutes } from '../src/routes/native.js';
test('native push payload never includes customer financial or identity text',()=>{
  const json=JSON.stringify(nativeMessage('payment.paid'));
  assert.ok(json.includes('channel_id'));assert.ok(!json.includes('amount'));assert.ok(!json.includes('phone'));
  assert.equal(nativeMessage('order.created').data.screen,'account');
});
test('native multipart attachments preserve credit scope before storage and derive owner from auth',async()=>{
  const app=Fastify();await app.register(multipart);
  app.decorate('requireUser',async(req,reply)=>{if(!req.headers.authorization)return reply.code(401).send({ok:false});req.currentUser={id:7} as typeof req.currentUser;});
  const seen:Array<{ownerId:number;scope:string;filename:string}>=[];
  await app.register(createNativeRoutes({nativePushEnabled:async()=>true,registerNativeDevice:async()=>{},removeNativeDevice:async()=>{},uploadNativeAttachment:async(input)=>{seen.push(input);return {url:'/api/files/99'} as Awaited<ReturnType<typeof import('../src/services/native-uploads.js').uploadNativeAttachment>>;}}));
  const boundary='native-upload-test';
  const body=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="credit.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\n%%EOF\r\n--${boundary}\r\nContent-Disposition: form-data; name="scope"\r\n\r\ncredit\r\n--${boundary}\r\nContent-Disposition: form-data; name="ownerId"\r\n\r\n999\r\n--${boundary}--\r\n`);
  const response=await app.inject({method:'POST',url:'/native/uploads',headers:{authorization:'Bearer test','content-type':`multipart/form-data; boundary=${boundary}`},payload:body});
  assert.equal(response.statusCode,200,response.body);assert.equal(seen[0]?.scope,'credit');assert.equal(seen[0]?.ownerId,7);
  assert.equal(response.json().url,'/api/files/99');await app.close();
});
test('registration accepts only bounded Android FCM token and no injected owner',()=>{
  const input={installationId:'123e4567-e89b-42d3-a456-426614174000',token:'a'.repeat(180),platform:'android'};
  assert.ok(nativeDeviceSchema.safeParse(input).success);
  assert.ok(!nativeDeviceSchema.safeParse({...input,userId:8}).success);
  assert.ok(!nativeDeviceSchema.safeParse({...input,token:'https://evil.example'}).success);
  assert.ok(!nativeDeviceSchema.safeParse({...input,token:'x'.repeat(5000)}).success);
});
test('native endpoints derive owner from session; anonymous registration is denied',async()=>{
  const calls:unknown[][]=[];
  const app=Fastify();
  app.decorate('requireUser',async(req,reply)=>{if(req.headers.authorization!=='Bearer test')return reply.code(401).send({ok:false});req.currentUser={id:7} as typeof req.currentUser;req.sessionToken='test';});
  await app.register(createNativeRoutes({nativePushEnabled:async()=>true,registerNativeDevice:async(...args)=>{calls.push(args);},removeNativeDevice:async(...args)=>{calls.push(args);},uploadNativeAttachment:async()=>({url:'/api/files/1'} as Awaited<ReturnType<typeof import('../src/services/native-uploads.js').uploadNativeAttachment>>)}));
  const body={installationId:'123e4567-e89b-42d3-a456-426614174000',token:'a'.repeat(180),platform:'android'};
  assert.equal((await app.inject({method:'POST',url:'/native/push-devices',payload:body})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/native/push-devices',headers:{authorization:'Bearer test'},payload:body})).statusCode,200);
  assert.equal(calls[0]?.[0],7);
  await app.inject({method:'DELETE',url:'/native/push-devices',headers:{authorization:'Bearer test'},payload:{installationId:body.installationId}});
  assert.equal(calls[1]?.[0],7);
  const config=await app.inject('/native/config');assert.deepEqual(config.json(),{ok:true,pushEnabled:true,minimumVersion:'1.0.0'});
  await app.close();
});
