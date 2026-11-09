import { and, asc, desc, eq, inArray, isNull, or, ilike, sql } from 'drizzle-orm';
import { campaignEvent, type CampaignDraft, type CampaignStats, type CampaignStatus, type NativeCampaignDTO, type NativeDestination, type DeliveryStatus, type CampaignPreview } from '@tamas/shared';
import { db, type Db } from '../db/client.js';
import { nativeCampaigns as campaigns, nativeCampaignDeliveries as deliveries, users } from '../db/schema.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { sha256 } from '../lib/hash.js';
import { nativeMessage } from '../lib/native-push.js';
import { activeNativeDevices, nativePushEnabled, sendNativeDevice, type NativeSendResult } from './native-push.js';

type Campaign = typeof campaigns.$inferSelect;
type Delivery = typeof deliveries.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
const emptyStats = (): CampaignStats => ({ total: 0, customers: 0, queued: 0, processing: 0, accepted: 0, failed: 0, skipped: 0, unknown: 0, cancelled: 0, received: 0, opened: 0 });
export async function campaignStats(ids: number[]): Promise<Map<number, CampaignStats>> {
  const result = new Map<number, CampaignStats>();
  if (!ids.length) return result;
  const grouped = await db.select({ campaignId: deliveries.campaignId, status: deliveries.status, n: sql<number>`count(*)::int`,
    received: sql<number>`count(*) filter (where ${deliveries.receivedAt} is not null)::int`, opened: sql<number>`count(*) filter (where ${deliveries.openedAt} is not null)::int` })
    .from(deliveries).where(inArray(deliveries.campaignId, ids)).groupBy(deliveries.campaignId, deliveries.status);
  const customers = await db.select({ campaignId: deliveries.campaignId, n: sql<number>`count(distinct ${deliveries.userId})::int` }).from(deliveries).where(inArray(deliveries.campaignId, ids)).groupBy(deliveries.campaignId);
  for (const row of grouped) {
    const stats = result.get(row.campaignId) || emptyStats();
    stats[row.status as DeliveryStatus] = row.n; stats.total += row.n; stats.received += row.received; stats.opened += row.opened;
    result.set(row.campaignId, stats);
  }
  for (const row of customers) { const stats = result.get(row.campaignId) || emptyStats(); stats.customers = row.n; result.set(row.campaignId, stats); }
  return result;
}
function dto(row: Campaign, stats = emptyStats()): NativeCampaignDTO {
  return { ...row, destination: row.destination as NativeDestination, audience: row.audience as CampaignDraft['audience'], status: row.status as CampaignStatus,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), queuedAt: row.queuedAt?.toISOString() || null, completedAt: row.completedAt?.toISOString() || null, stats };
}
async function findCampaign(id: number) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!row) throw notFound('اعلان پیدا نشد.'); return row;
}
async function selectedCustomers(userIds: number[]) {
  if (!userIds.length) return [];
  return db.select({ id: users.id, name: users.name, lastName: users.lastName, phone: users.phone, storeName: users.storeName }).from(users)
    .where(and(inArray(users.id, userIds), eq(users.role, 'customer'), isNull(users.deletedAt)));
}
export async function listCampaigns(page: number, status?: CampaignStatus, q?: string) {
  const where = and(status ? eq(campaigns.status, status) : undefined, q ? or(ilike(campaigns.title, `%${q}%`), ilike(campaigns.body, `%${q}%`)) : undefined);
  const [rows, count] = await Promise.all([db.select().from(campaigns).where(where).orderBy(desc(campaigns.id)).limit(20).offset((page - 1) * 20), db.select({ n: sql<number>`count(*)::int` }).from(campaigns).where(where)]);
  const stats = await campaignStats(rows.map(r => r.id));
  return { items: rows.map(row => dto(row, stats.get(row.id))), total: count[0]?.n || 0, page, perPage: 20 };
}
export async function campaignDetail(id: number, page: number, status?: DeliveryStatus) {
  const row = await findCampaign(id);
  const where = and(eq(deliveries.campaignId, id), status ? eq(deliveries.status, status) : undefined);
  const [stats, entries, count, selected] = await Promise.all([
    campaignStats([id]), db.select({ delivery: deliveries, name: users.name, lastName: users.lastName, phone: users.phone }).from(deliveries).leftJoin(users, eq(users.id, deliveries.userId)).where(where).orderBy(asc(deliveries.id)).limit(30).offset((page - 1) * 30),
    db.select({ n: sql<number>`count(*)::int` }).from(deliveries).where(where), selectedCustomers(row.userIds),
  ]);
  return { campaign: dto(row, stats.get(id)), selectedCustomers: selected, items: entries.map(({ delivery: d, name, lastName, phone }) => ({
    id: d.id, userId: d.userId, name: [name, lastName].filter(Boolean).join(' ') || 'مشتری حذف‌شده', phone: phone || '—', status: d.status, attempts: d.attempts,
    error: d.error, sentAt: d.sentAt?.toISOString() || null, receivedAt: d.receivedAt?.toISOString() || null, openedAt: d.openedAt?.toISOString() || null, updatedAt: d.updatedAt.toISOString(),
  })), total: count[0]?.n || 0, page, perPage: 30 };
}
export async function campaignCustomers(q: string, page: number) {
  const match = q ? `%${q.replace(/[%_\\]/g, '\\$&')}%` : undefined;
  const where = and(eq(users.role, 'customer'), eq(users.isActive, true), isNull(users.deletedAt), match ? or(ilike(users.phone, match), ilike(users.name, match), ilike(users.lastName, match), ilike(users.storeName, match)) : undefined);
  const [rows, count] = await Promise.all([db.select({ id: users.id, name: users.name, lastName: users.lastName, phone: users.phone, storeName: users.storeName }).from(users).where(where).orderBy(desc(users.id)).limit(30).offset((page - 1) * 30), db.select({ n: sql<number>`count(*)::int` }).from(users).where(where)]);
  const devices = await activeNativeDevices(rows.map(r => r.id));
  return { items: rows.map(r => ({ ...r, devices: devices.filter(d => d.userId === r.id).length })), total: count[0]?.n || 0, page, perPage: 30 };
}
export async function saveCampaign(input: CampaignDraft, actorId: number, id?: number, revision?: number) {
  if (input.audience === 'selected') {
    const selected = await selectedCustomers(input.userIds);
    if (selected.length !== input.userIds.length) throw badRequest('فهرست مشتریان معتبر نیست؛ حساب مدیر و اپراتور قابل انتخاب نیست.');
  }
  if (!id) {
    const [row] = await db.insert(campaigns).values({ ...input, createdBy: actorId }).returning(); return dto(row!);
  }
  const [row] = await db.update(campaigns).set({ ...input, revision: sql`${campaigns.revision} + 1`, updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, 'draft'), eq(campaigns.revision, revision || 0))).returning();
  if (!row) throw conflict('این پیش‌نویس تغییر کرده یا قبلاً ارسال شده است. صفحه را تازه کنید.'); return dto(row);
}
async function targets(campaign: Campaign, reader: Pick<Db, 'select' | 'selectDistinctOn'> = db) {
  const customers = await reader.select({ id: users.id }).from(users).where(and(eq(users.role, 'customer'), eq(users.isActive, true), isNull(users.deletedAt), campaign.audience === 'selected' ? inArray(users.id, campaign.userIds) : undefined)).orderBy(asc(users.id));
  const devices = await activeNativeDevices(customers.map(u => u.id), reader);
  const canonical = devices.map(d => [d.userId, d.installationId, sha256(d.token), d.sessionHash]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const token = sha256(JSON.stringify([campaign.id, campaign.revision, customers.map(c => c.id), canonical]));
  return { customers, devices, token };
}
export async function previewCampaign(id: number): Promise<CampaignPreview> {
  const c = await findCampaign(id); const t = await targets(c); const reachable = new Set(t.devices.map(d => d.userId)).size;
  return { customers: t.customers.length, reachable, devices: t.devices.length, skipped: t.customers.length - reachable, token: t.token, pushEnabled: await nativePushEnabled() };
}
export async function queueCampaign(id: number, revision: number, previewToken: string) {
  if (!await nativePushEnabled()) throw badRequest('سرویس پوش در سرور فعال نیست.');
  await db.transaction(async tx => {
    const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for('update');
    if (!c) throw notFound('اعلان پیدا نشد.');
    if (c.status !== 'draft' || c.revision !== revision) throw conflict('اعلان تغییر کرده یا قبلاً به صف اضافه شده است.');
    const t = await targets(c, tx);
    if (previewToken !== t.token) throw conflict('گیرندگان از زمان پیش‌نمایش تغییر کرده‌اند. پیش‌نمایش را تازه کنید.');
    if (!t.devices.length) throw badRequest('هیچ دستگاه متصل و دارای نشست معتبر برای ارسال وجود ندارد.');
    const reachable = new Set(t.devices.map(d => d.userId));
    const rows = [
      ...t.devices.map(d => ({ campaignId: id, userId: d.userId, installationId: d.installationId, tokenHash: sha256(d.token), sessionHash: d.sessionHash, status: 'queued', error: null })),
      ...t.customers.filter(c => !reachable.has(c.id)).map(c => ({ campaignId: id, userId: c.id, installationId: null, tokenHash: null, sessionHash: null, status: 'skipped', error: 'NO_ACTIVE_DEVICE' })),
    ];
    for (let offset = 0; offset < rows.length; offset += 500) await tx.insert(deliveries).values(rows.slice(offset, offset + 500));
    await tx.update(campaigns).set({ status: 'queued', queuedAt: new Date(), updatedAt: new Date() }).where(eq(campaigns.id, id));
  });
  return (await campaignDetail(id, 1)).campaign;
}
export async function cancelCampaign(id: number) {
  await db.transaction(async tx => {
    const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for('update');
    if (!c || !['draft', 'queued', 'sending'].includes(c.status)) throw conflict('این اعلان قابل لغو نیست.');
    await tx.update(campaigns).set({ status: 'cancelled', completedAt: new Date(), updatedAt: new Date() }).where(eq(campaigns.id, id));
    await tx.update(deliveries).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(deliveries.campaignId, id), eq(deliveries.status, 'queued')));
  });
}
export async function retryCampaign(id: number) {
  await db.transaction(async tx => {
    const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for('update');
    if (!c || c.status !== 'completed') throw conflict('ابتدا باید ارسال جاری تمام شود.');
    const rows = await tx.select().from(deliveries).where(and(eq(deliveries.campaignId, id), eq(deliveries.status, 'failed')));
    if (!rows.length) throw badRequest('ارسال ناموفق قابل تکرار وجود ندارد.');
    const devices = await activeNativeDevices([...new Set(rows.flatMap(r => r.userId ? [r.userId] : []))], tx);
    let queued = 0;
    for (const row of rows) {
      const device = devices.find(d => d.userId === row.userId && d.installationId === row.installationId);
      if (device) {
        queued += 1;
        await tx.update(deliveries).set({ status: 'queued', tokenHash: sha256(device.token), sessionHash: device.sessionHash, error: null, updatedAt: new Date() }).where(eq(deliveries.id, row.id));
      } else await tx.update(deliveries).set({ status: 'skipped', error: 'DEVICE_OR_SESSION_CHANGED', updatedAt: new Date() }).where(eq(deliveries.id, row.id));
    }
    await tx.update(campaigns).set({ status: queued ? 'queued' : 'completed', completedAt: queued ? null : new Date(), updatedAt: new Date() }).where(eq(campaigns.id, id));
  });
}
export function campaignPayload(c: Pick<Campaign, 'id' | 'title' | 'body' | 'destination'>, deliveryId: number) {
  const event = campaignEvent(c.destination as NativeDestination);
  const data = { event, destination: c.destination, campaignId: String(c.id), deliveryId: String(deliveryId) };
  return { ...nativeMessage(event), notification: { title: c.title, body: c.body }, data: { ...data, body: JSON.stringify(data) } };
}
async function claim(tx: Tx) {
  // Match cancel/retry's lock order: campaign first, then delivery.
  const [campaign] = await tx.select().from(campaigns).where(and(inArray(campaigns.status, ['queued', 'sending']),
    sql`exists (select 1 from ${deliveries} where ${deliveries.campaignId} = ${campaigns.id} and ${deliveries.status} = 'queued')`)).orderBy(asc(campaigns.id)).limit(1).for('update', { skipLocked: true });
  if (!campaign) return null;
  const [delivery] = await tx.select().from(deliveries).where(and(eq(deliveries.campaignId, campaign.id), eq(deliveries.status, 'queued'))).orderBy(asc(deliveries.id)).limit(1).for('update', { skipLocked: true });
  if (!delivery) return null;
  await tx.update(deliveries).set({ status: 'processing', attempts: sql`${deliveries.attempts} + 1`, processingAt: new Date(), updatedAt: new Date() }).where(eq(deliveries.id, delivery.id));
  await tx.update(campaigns).set({ status: 'sending', updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
  return { delivery, campaign };
}
let running = false;
export async function processNativeCampaigns(send = sendNativeDevice, limit = 20) {
  if (running) return 0; running = true;
  let processed = 0;
  try {
    // An interrupted HTTP send may already have reached FCM. Never silently resend it.
    await db.update(deliveries).set({ status: 'unknown', error: 'WORKER_INTERRUPTED', updatedAt: new Date() }).where(and(eq(deliveries.status, 'processing'), sql`${deliveries.processingAt} < now() - interval '5 minutes'`));
    for (let i = 0; i < limit; i += 1) {
      const row = await db.transaction(claim); if (!row) break;
      const d = row.delivery;
      const device = d.userId ? (await activeNativeDevices([d.userId])).find(device => device.installationId === d.installationId && device.sessionHash === d.sessionHash && sha256(device.token) === d.tokenHash) : undefined;
      const current = await findCampaign(row.campaign.id);
      let result: NativeSendResult | { status: 'skipped' | 'cancelled'; code: string };
      if (current.status === 'cancelled') result = { status: 'cancelled', code: 'CAMPAIGN_CANCELLED' };
      else if (!device) result = { status: 'skipped', code: 'DEVICE_OR_SESSION_CHANGED' };
      else {
        try { result = await send(device, campaignPayload(row.campaign, d.id)); }
        catch { result = { status: 'unknown', code: 'NETWORK_RESULT_UNKNOWN' }; }
      }
      await db.update(deliveries).set({ status: result.status, error: result.code || null, providerMessageId: 'messageId' in result ? result.messageId || null : null, sentAt: result.status === 'accepted' ? new Date() : null, updatedAt: new Date() }).where(and(eq(deliveries.id, d.id), eq(deliveries.status, 'processing')));
      processed += 1;
    }
    await db.update(campaigns).set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() }).where(and(inArray(campaigns.status, ['queued', 'sending']), sql`not exists (select 1 from ${deliveries} where ${deliveries.campaignId} = ${campaigns.id} and ${deliveries.status} in ('queued', 'processing'))`));
    return processed;
  } finally { running = false; }
}
export async function recordCampaignReceipt(userId: number, sessionToken: string, installationId: string, deliveryId: number, kind: 'received' | 'opened') {
  await db.update(deliveries).set({ receivedAt: sql`coalesce(${deliveries.receivedAt}, now())`, ...(kind === 'opened' ? { openedAt: sql`coalesce(${deliveries.openedAt}, now())` } : {}), updatedAt: new Date() })
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.userId, userId), eq(deliveries.installationId, installationId), eq(deliveries.sessionHash, sha256(sessionToken)), inArray(deliveries.status, ['processing', 'accepted', 'unknown'])));
}
