/** Standalone release-APK QA, never imported by the production server. */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const config = JSON.parse(readFileSync(process.argv[2] || '', 'utf8')) as Record<string,string>;
if (!config.QA_PASSWORD || !config.APP_SECRET) throw new Error('Private QA credentials are required');
const qaPassword = config.QA_PASSWORD;
const url = new URL(config.DATABASE_URL || '');
if (!/^\/tamas_native_qa_\d{8}$/.test(url.pathname) || url.username !== url.pathname.slice(1) || url.hostname !== '127.0.0.1') throw new Error('A separate, dedicated QA database and role are required.');
// Discard every production credential loaded by dotenv before any application import.
const { parse } = await import('dotenv');
for (const key of Object.keys(parse(readFileSync('.env')))) delete process.env[key];
Object.assign(process.env, config, {NODE_ENV:'test',HOST:'127.0.0.1',PORT:'3103',PUBLIC_SITE_URL:'http://127.0.0.1:3103',OTP_PROVIDER:'console',CRM_SYNC_ENABLED:'false',SHEETS_ENABLED:'false',SHEETS_SYNC_PRIVATE_DATA:'false',PRODUCT_IMAGE_MIRROR_ENABLED:'false',ADMIN_PHONES:'',STORAGE_ROOT:resolve('../../.private/native-qa-storage'),PRIVATE_STORAGE_ROOT:resolve('../../.private/native-qa-documents'),LOG_LEVEL:'warn'});
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input, init) => {
  const target = new URL(input instanceof Request ? input.url : String(input));
  if (!['oauth2.googleapis.com','fcm.googleapis.com','127.0.0.1'].includes(target.hostname)) throw new Error(`QA outbound request blocked: ${target.hostname}`);
  return originalFetch(input,init);
}) as typeof fetch;
const { db, sql, schema } = await import('../src/db/client.js');
const database = (await sql`select current_database() as database`)[0]?.database;
if (database !== config.QA_DATABASE) throw new Error('QA database mismatch');
const { hashPassword } = await import('../src/lib/hash.js');
const { eq } = await import('drizzle-orm');
if (!(await db.select().from(schema.users).limit(1)).length) {
  await db.insert(schema.users).values([1,2].map(n=>({phone:`0900000000${n}`,name:'مشتری آزمایشی',lastName:String(n),storeName:'فروشگاه تست',landline:'03400000000',address:'نشانی ساختگی محیط آزمایش',postalCode:'0000000000',activity:'تست',certificateFileUrl:'/api/files/qa-placeholder',isActive:true,passwordHash:hashPassword(qaPassword)})));
  await db.insert(schema.products).values([{productId:'QA-ACCESSORY',sku:'00000000001',title:'کابل آزمایشی — غیرقابل فروش',model:'QA Cable',price:100000,kermanStock:20,tehranStock:5,stock:25,searchText:'qa test کابل آزمایشی',status:'active'}]);
  await db.insert(schema.settings).values([{key:'CRM_SYNC_ENABLED',value:'false'},{key:'WALLET_ENABLED',value:'true'},{key:'WALLET_ORDER_PAYMENT_ENABLED',value:'true'}]);
}
if (!(await db.select().from(schema.users).where(eq(schema.users.phone, '09000000003')).limit(1)).length) {
  await db.insert(schema.users).values({ phone:'09000000003', name:'مدیر آزمایشی',lastName:'محیط جدا',storeName:'تست',address:'نشانی ساختگی',isActive:true,role:'admin',passwordHash:hashPassword(qaPassword) });
}
// Only the bank transport is simulated. Verification, ledger and stock code stay real.
// @ts-ignore -- the existing gateway package is JavaScript.
const gateway = (await import('@tamas/payment')).default;
const bank = new Map<string,{amount:number;success?:boolean}>();
gateway.Create = async ({amount}:{amount:number}) => {const id=randomUUID();bank.set(id,{amount});return {data:{status:'success',transid:id}};};
gateway.Verify = async ({transid}:{transid:string}) => ({data:bank.get(transid)?.success ? {status:'success',tracking_code:`QA-${transid}`} : {status:'error',code:'QA_DECLINED'}});
gateway.StartPay = (id:string) => `http://127.0.0.1:3103/qa/bank/${id}`;
const { buildApp } = await import('../src/app.js');
const app = await buildApp();
app.post('/qa/process-notifications',async(req)=>{
  const { processNativeCampaigns }=await import('../src/services/native-campaigns.js');
  const live=(req.body as {live?:boolean}|null)?.live===true;
  return {processed:await processNativeCampaigns(live ? undefined : async()=>({status:'accepted',messageId:`qa/${randomUUID()}`}))};
});
app.get('/qa/bank/:id', async (req,reply)=>{
  const {id}=req.params as {id:string}; if(!bank.has(id)) return reply.code(404).send();
  return reply.type('text/html; charset=utf-8').send(`<html dir="rtl"><meta name="viewport" content="width=device-width"><h1>درگاه آزمایشی — بدون برداشت وجه</h1><p>مبلغ: ${bank.get(id)!.amount} تومان</p><p><a href="/qa/settle/${id}/success">پرداخت موفق آزمایشی</a></p><p><a href="/qa/settle/${id}/failed">پرداخت ناموفق آزمایشی</a></p></html>`);
});
app.get('/qa/settle/:id/:result',async(req,reply)=>{
  const {id,result}=req.params as {id:string;result:string}; const entry=bank.get(id);if(!entry)return reply.code(404).send();entry.success=result==='success';return reply.redirect(`/api/payment/callback?transid=${id}`);
});
app.get('/wallet',async(_req,reply)=>reply.type('text/html; charset=utf-8').send('<html dir="rtl"><h1>بازگشت به اپ آزمایشی</h1><a href="tamasmarket://wallet">بازگشت به کیف پول</a></html>'));
app.get('/payment/result',async(_req,reply)=>reply.type('text/html; charset=utf-8').send('<html dir="rtl"><h1>نتیجه پرداخت آزمایشی</h1><a href="tamasmarket://orders">بازگشت به اپ</a></html>'));
app.get('/qa/state',async()=>({users:await db.select({id:schema.users.id,phone:schema.users.phone}).from(schema.users),orders:await db.select().from(schema.orders),wallets:await db.select().from(schema.walletAccounts),ledger:await db.select().from(schema.walletTransactions),stock:await db.select({productId:schema.products.productId,kerman:schema.products.kermanStock,tehran:schema.products.tehranStock}).from(schema.products),devices:(await db.select().from(schema.nativePushDevices)).map(d=>({userId:d.userId,enabled:d.enabled,installationId:d.installationId})),bank:[...bank.keys()]}));
app.post('/qa/push',async(req)=>{const {event='order.created',userId=1}=req.body as {event?:string;userId?:number};if(![1,2].includes(userId))throw new Error('Synthetic users only');const {sendNativeNotification}=await import('../src/services/native-push.js');return {accepted:await sendNativeNotification(userId,event)};});
await app.listen({host:'127.0.0.1',port:3103});
console.log('ISOLATED_NATIVE_QA_READY');
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>void app.close().then(()=>sql.end()).then(()=>process.exit(0)));
