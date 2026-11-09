/** Real HTTP -> auth -> PostgreSQL checks, in disposable tables with no customer data. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { hashPassword, sha256 } from '../src/lib/hash.js';
const originalUrl=process.env.DATABASE_URL;
if(!originalUrl)throw new Error('DATABASE_URL is required');
const namespace=`qa_native_${Date.now()}_${randomBytes(4).toString('hex')}`;
if(!/^qa_native_\d+_[a-f0-9]{8}$/.test(namespace))throw new Error('Unsafe test namespace');
const admin=postgres(originalUrl,{max:1});
let cleanup:undefined|(()=>Promise<void>);
try{
  await admin.unsafe(`CREATE SCHEMA "${namespace}"`);
  for(const table of ['users','sessions','access_groups']){
    await admin.unsafe(`CREATE TABLE "${namespace}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    if(table!=='access_groups'){
      await admin.unsafe(`CREATE SEQUENCE "${namespace}"."${table}_local_id_seq"`);
      await admin.unsafe(`ALTER TABLE "${namespace}"."${table}" ALTER COLUMN id SET DEFAULT nextval('"${namespace}"."${table}_local_id_seq"')`);
    }
  }
  await admin.unsafe(`CREATE TABLE "${namespace}".native_push_devices (installation_id varchar(36) PRIMARY KEY,user_id integer NOT NULL,session_hash varchar(64) NOT NULL,token text NOT NULL,enabled boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now())`);
  const isolated=new URL(originalUrl);isolated.searchParams.set('options',`-c search_path=${namespace},public`);
  process.env.DATABASE_URL=isolated.href;
  const {sql,closeDb}=await import('../src/db/client.js');cleanup=closeDb;
  assert.equal((await sql`select current_schema() as name`)[0]?.name,namespace);
  const password='IsolatedNativeTest-NotACustomer';
  await sql`insert into users(phone,name,last_name,store_name,address,is_active,role,password_hash) values
    ('09000000001','آزمون اول','محیط جدا','فروشگاه آزمون','نشانی آزمون',true,'customer',${hashPassword(password)}),
    ('09000000002','آزمون دوم','محیط جدا','فروشگاه آزمون','نشانی آزمون',true,'customer',${hashPassword(password)})`;
  const app=Fastify();await app.register(cookie);
  await app.register((await import('../src/plugins/auth.js')).default);
  await app.register((await import('../src/routes/auth.js')).default,{prefix:'/api'});
  await app.register((await import('../src/routes/native.js')).default,{prefix:'/api'});
  const login=async(phone:string)=>{const r=await app.inject({method:'POST',url:'/api/auth/password/login',payload:{phone,password}});assert.equal(r.statusCode,200,r.body);return r.json() as {token:string;user:{id:number}};};
  const one=await login('09000000001'),two=await login('09000000002');
  const installationId='123e4567-e89b-42d3-a456-426614174000';
  const body={installationId,token:'isolated-native-token-not-a-real-device-'.repeat(4),platform:'android'};
  assert.equal((await app.inject({method:'POST',url:'/api/native/push-devices',payload:body})).statusCode,401);
  const headers={authorization:`Bearer ${one.token}`};
  const me=await app.inject({url:'/api/auth/me',headers});assert.equal(me.json().user.id,one.user.id);
  const added=await app.inject({method:'POST',url:'/api/native/push-devices',headers,payload:body});assert.equal(added.statusCode,200,added.body);
  let [device]=await sql`select user_id,session_hash from native_push_devices where installation_id=${installationId}`;
  assert.equal(device?.user_id,one.user.id);assert.equal(device?.session_hash,sha256(one.token));
  await app.inject({method:'DELETE',url:'/api/native/push-devices',headers:{authorization:`Bearer ${two.token}`},payload:{installationId}});
  assert.equal((await sql`select count(*)::int as n from native_push_devices`)[0]?.n,1);
  await app.inject({method:'POST',url:'/api/native/push-devices',headers:{authorization:`Bearer ${two.token}`},payload:body});
  [device]=await sql`select user_id,session_hash from native_push_devices where installation_id=${installationId}`;
  assert.equal(device?.user_id,two.user.id);assert.equal(device?.session_hash,sha256(two.token));
  await app.inject({method:'POST',url:'/api/auth/logout',headers:{authorization:`Bearer ${two.token}`}});
  assert.equal((await app.inject({url:'/api/auth/me',headers:{authorization:`Bearer ${two.token}`}})).statusCode,401);
  const [active]=await sql`select count(*)::int as n from native_push_devices d join sessions s on s.token_hash=d.session_hash and s.user_id=d.user_id where s.expires_at>now()`;
  assert.equal(active?.n,0);
  await app.close();
  console.log(JSON.stringify({ok:true,checks:['password-login','bearer-me','anonymous-denied','persisted-registration','cross-user-delete-denied','device-rebound-on-account-change','logout-revokes-push'],realCustomerWrites:0}));
}finally{
  if(cleanup)await cleanup();
  // Exact, agent-created disposable namespace only. Never public/customer tables.
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
  await admin.end();
  console.log('Temporary native QA schema removed.');
}
