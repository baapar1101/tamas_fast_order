import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { nativeDeviceSchema, nativeMessage } from '../src/lib/native-push.js';
import { createNativeRoutes } from '../src/routes/native.js';
test('native push payload never includes customer financial or identity text',()=>{
  const json=JSON.stringify(nativeMessage('payment.paid'));
  assert.ok(json.includes('channel_id'));assert.ok(!json.includes('amount'));assert.ok(!json.includes('phone'));
  assert.equal(nativeMessage('order.created').data.screen,'account');
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
  await app.register(createNativeRoutes({nativePushEnabled:async()=>true,registerNativeDevice:async(...args)=>{calls.push(args);},removeNativeDevice:async(...args)=>{calls.push(args);},sendNativeNotification:async()=>false,verifyNativePushConfiguration:async()=>({ok:true,project:'test',validationOnly:true})}));
  const body={installationId:'123e4567-e89b-42d3-a456-426614174000',token:'a'.repeat(180),platform:'android'};
  assert.equal((await app.inject({method:'POST',url:'/native/push-devices',payload:body})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/native/push-devices',headers:{authorization:'Bearer test'},payload:body})).statusCode,200);
  assert.equal(calls[0]?.[0],7);
  await app.inject({method:'DELETE',url:'/native/push-devices',headers:{authorization:'Bearer test'},payload:{installationId:body.installationId}});
  assert.equal(calls[1]?.[0],7);
  const config=await app.inject('/native/config');assert.deepEqual(config.json(),{ok:true,pushEnabled:true,minimumVersion:'1.0.0'});
  await app.close();
});
