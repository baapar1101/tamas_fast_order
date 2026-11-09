/** Destructive only to a dedicated disposable QA database; never a production URL. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import type { NativeCampaignDTO, CampaignPreview } from '@tamas/shared';
const config = JSON.parse(readFileSync(process.argv[2] || '', 'utf8')) as Record<string, string>;
const url = new URL(config.DATABASE_URL || '');
if (url.hostname !== '127.0.0.1' || !/^\/tamas_native_qa_\d{8}$/.test(url.pathname) || url.username !== url.pathname.slice(1)) throw new Error('Dedicated QA database required');
for (const key of Object.keys(parse(readFileSync('.env')))) delete process.env[key];
Object.assign(process.env, config, { NODE_ENV: 'test', DATABASE_POOL_MAX: '1', CRM_SYNC_ENABLED: 'false', SHEETS_ENABLED: 'false' });
const realFetch = globalThis.fetch;
globalThis.fetch = ((input, init) => { if (new URL(String(input)).hostname !== '127.0.0.1') throw new Error('No external QA sends'); return realFetch(input, init); }) as typeof fetch;
const { db, sql, schema: s } = await import('../src/db/client.js');
const service = await import('../src/services/native-campaigns.js');
const { activeNativeDevices } = await import('../src/services/native-push.js');
const { sha256, hashPassword } = await import('../src/lib/hash.js');
const { eq, and } = await import('drizzle-orm');
const base = 'http://127.0.0.1:3103';
let count = 0; const pass = (name: string) => { count += 1; console.log(`PASS ${name}`); };
async function request<T>(path: string, token = '', body?: unknown, status = 200, method = body ? 'POST' : 'GET'): Promise<T> {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json(); assert.equal(res.status, status, JSON.stringify(data)); return data as T;
}
type Saved = { campaign: NativeCampaignDTO };
const draft = { title: 'اعلان آزمایشی', body: 'این پیام فقط برای داده ساختگی است.', destination: 'wallet', audience: 'all', userIds: [] };
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002', C = '00000000-0000-4000-8000-000000000003';
try {
  assert.equal((await sql`select current_database() as name`)[0]?.name, config.QA_DATABASE);
  await db.delete(s.nativeCampaigns); await db.delete(s.nativePushDevices);
  const login = (phone: string) => request<{ token: string }>('/api/auth/password/login', '', { phone, password: config.QA_PASSWORD });
  const admin = (await login('09000000003')).token, one = (await login('09000000001')).token, two = (await login('09000000002')).token;
  const [group] = await db.insert(s.accessGroups).values({ name: 'QA-settings-only', permissions: ['manage_settings'] }).onConflictDoUpdate({ target: s.accessGroups.name, set: { permissions: ['manage_settings'] } }).returning();
  await db.insert(s.users).values({ phone: '09000000004', role: 'operator', isActive: true, accessGroupId: group!.id, passwordHash: hashPassword(config.QA_PASSWORD!) }).onConflictDoNothing();
  await db.insert(s.users).values({ phone: '09000000005', role: 'customer', isActive: false }).onConflictDoNothing();
  const operator = (await login('09000000004')).token;
  await request('/api/admin/app-notifications', '', undefined, 401);
  await request('/api/admin/app-notifications', one, undefined, 403);
  await request('/api/admin/app-notifications', operator, undefined, 403); pass('anonymous/customer/operator without dedicated permission denied');
  await request('/api/admin/app-notifications', admin, { ...draft, destination: 'https://bad.invalid' }, 400);
  await request('/api/admin/app-notifications', admin, { ...draft, audience: 'selected', userIds: [] }, 400);
  await request('/api/admin/app-notifications', admin, { ...draft, audience: 'selected', userIds: [3] }, 400); pass('external destination, empty selection and admin recipients rejected');
  const tokenA = 'qa-token-a'.repeat(8), tokenB = 'qa-token-b'.repeat(8), tokenC = 'qa-token-c'.repeat(8);
  await db.insert(s.nativePushDevices).values([
    { installationId: A, userId: 1, token: tokenA, sessionHash: sha256(one) },
    { installationId: B, userId: 1, token: tokenB, sessionHash: sha256(one) },
    { installationId: C, userId: 2, token: tokenC, sessionHash: sha256(two) },
  ]);
  const created = (await request<Saved>('/api/admin/app-notifications', admin, draft)).campaign;
  const preview = await request<CampaignPreview>(`/api/admin/app-notifications/${created.id}/preview`, admin);
  assert.equal(preview.customers, 2); assert.equal(preview.reachable, 2); assert.equal(preview.devices, 3); pass('audience excludes inactive/admin/operator and counts distinct customers/devices');
  const edited = (await request<Saved>(`/api/admin/app-notifications/${created.id}`, admin, { ...draft, title: 'عنوان ویرایش‌شده', revision: created.revision }, 200, 'PUT')).campaign;
  await request(`/api/admin/app-notifications/${created.id}/send`, admin, { revision: created.revision, previewToken: preview.token }, 409); pass('stale draft cannot send');
  const current = await request<CampaignPreview>(`/api/admin/app-notifications/${created.id}/preview`, admin);
  await db.update(s.sessions).set({ expiresAt: new Date(0) }).where(eq(s.sessions.tokenHash, sha256(two)));
  await request(`/api/admin/app-notifications/${created.id}/send`, admin, { revision: edited.revision, previewToken: current.token }, 409);
  await db.update(s.sessions).set({ expiresAt: new Date(Date.now() + 86400_000) }).where(eq(s.sessions.tokenHash, sha256(two))); pass('changed recipients invalidate preview');
  const payload = { revision: edited.revision, previewToken: current.token };
  const queued = await Promise.all([1, 2].map(() => fetch(base + `/api/admin/app-notifications/${created.id}/send`, { method: 'POST', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) })));
  assert.deepEqual(queued.map(r => r.status).sort(), [200, 409]);
  assert.equal((await db.select().from(s.nativeCampaignDeliveries).where(eq(s.nativeCampaignDeliveries.campaignId, created.id))).length, 3); pass('concurrent send queues each device only once');
  await service.processNativeCampaigns(async d => d.installationId === A ? { status: 'accepted', messageId: 'qa/accepted' } : d.installationId === B ? { status: 'failed', code: 'FCM_HTTP_503' } : { status: 'unknown', code: 'NETWORK_RESULT_UNKNOWN' });
  let c = (await service.campaignDetail(created.id, 1)).campaign;
  assert.equal(c.status, 'completed'); assert.equal(c.stats.accepted, 1); assert.equal(c.stats.failed, 1); assert.equal(c.stats.unknown, 1); pass('durable outcomes distinguish accepted, failed and uncertain');
  const rotated = 'qa-rotated-token-b'.repeat(8);
  await db.update(s.nativePushDevices).set({ token: rotated, updatedAt: new Date() }).where(eq(s.nativePushDevices.installationId, B));
  await service.retryCampaign(created.id); let retried = 0;
  await service.processNativeCampaigns(async d => { assert.equal(d.installationId, B); assert.equal(d.token, rotated); retried += 1; return { status: 'accepted' }; });
  assert.equal(retried, 1); c = (await service.campaignDetail(created.id, 1)).campaign; assert.equal(c.stats.accepted, 2); assert.equal(c.stats.unknown, 1); pass('retry never resends accepted or uncertain deliveries');
  const [a] = await db.select().from(s.nativeCampaignDeliveries).where(and(eq(s.nativeCampaignDeliveries.campaignId, created.id), eq(s.nativeCampaignDeliveries.installationId, A)));
  await request('/api/native/notification-receipts', two, { installationId: A, deliveryId: a!.id, kind: 'opened' });
  assert.equal((await service.campaignDetail(created.id, 1)).campaign.stats.opened, 0); pass('other account cannot acknowledge a delivery');
  await request('/api/native/notification-receipts', one, { installationId: A, deliveryId: a!.id, kind: 'opened' });
  await request('/api/native/notification-receipts', one, { installationId: A, deliveryId: a!.id, kind: 'opened' });
  const acknowledged = (await service.campaignDetail(created.id, 1)).campaign.stats;
  assert.equal(acknowledged.opened, 1); assert.equal(acknowledged.received, 1); pass('received/opened acknowledgments are owned and idempotent');
  const cancelled = await service.saveCampaign({ ...draft, destination: 'store', audience: 'all' }, 3);
  const cp = await service.previewCampaign(cancelled.id); await service.queueCampaign(cancelled.id, cancelled.revision, cp.token); await service.cancelCampaign(cancelled.id);
  let sent = 0; await service.processNativeCampaigns(async () => { sent += 1; return { status: 'accepted' }; }); assert.equal(sent, 0); pass('cancelling a queue prevents pending sends');
  await db.update(s.nativePushDevices).set({ token: tokenA, updatedAt: new Date(Date.now() + 1000) }).where(eq(s.nativePushDevices.installationId, C));
  assert.ok(!(await activeNativeDevices([1])).some(d => d.installationId === A)); pass('a token rebound to another account is never sent for its former owner');
  const expire = await service.saveCampaign({ ...draft, destination: 'wallet', audience: 'selected', userIds: [1] }, 3);
  const ep = await service.previewCampaign(expire.id); await service.queueCampaign(expire.id, expire.revision, ep.token);
  await db.update(s.sessions).set({ expiresAt: new Date(0) }).where(eq(s.sessions.tokenHash, sha256(one)));
  sent = 0; await service.processNativeCampaigns(async () => { sent += 1; return { status: 'accepted' }; }); assert.equal(sent, 0); assert.equal((await service.campaignDetail(expire.id, 1)).campaign.stats.skipped, 1); pass('worker checks current session before every send');
  const empty = await service.saveCampaign({ ...draft, destination: 'account', audience: 'selected', userIds: [1] }, 3);
  const np = await service.previewCampaign(empty.id); assert.equal(np.devices, 0);
  await assert.rejects(() => service.queueCampaign(empty.id, empty.revision, np.token)); pass('zero reachable devices cannot start a campaign');
  const interrupted = await service.saveCampaign({ ...draft, destination: 'account', audience: 'selected', userIds: [2] }, 3);
  const ip = await service.previewCampaign(interrupted.id); await service.queueCampaign(interrupted.id, interrupted.revision, ip.token);
  await db.update(s.nativeCampaignDeliveries).set({ status: 'processing', processingAt: new Date(Date.now() - 600_000) }).where(eq(s.nativeCampaignDeliveries.campaignId, interrupted.id));
  sent = 0; await service.processNativeCampaigns(async () => { sent += 1; return { status: 'accepted' }; }); assert.equal(sent, 0); assert.equal((await service.campaignDetail(interrupted.id, 1)).campaign.stats.unknown, 1); pass('interrupted sends become uncertain without duplicate retry');
  const serialized = JSON.stringify(await service.campaignDetail(created.id, 1));
  assert.ok(!serialized.includes(tokenA)); assert.ok(!serialized.includes(sha256(one))); pass('admin history never exposes push tokens or session hashes');
  console.log(`${count} isolated campaign checks passed; external sends: 0`);
} finally {
  await db.delete(s.nativePushDevices);
  await sql.end();
}
