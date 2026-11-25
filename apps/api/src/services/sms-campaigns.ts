import { createHash, createHmac } from 'node:crypto';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { isValidPhone, normalizePhone } from '@tamas/shared';
import { z } from 'zod';
import { db, type Db } from '../db/client.js';
import { env } from '../env.js';
import { smsCampaigns, smsCampaignDeliveries, users } from '../db/schema.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { sendSms } from './sms.js';

export const smsCampaignInput = z.object({
  body: z.string().trim().min(1).max(1000),
  audience: z.enum(['all', 'selected']),
  userIds: z.array(z.number().int().positive()).max(300).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.audience === 'selected' && value.userIds.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'حداقل یک مشتری انتخاب کنید.', path: ['userIds'] });
  }
  if (value.audience === 'all' && value.userIds.length) {
    ctx.addIssue({ code: 'custom', message: 'برای همهٔ مشتریان، فهرست انتخابی باید خالی باشد.', path: ['userIds'] });
  }
  if (new Set(value.userIds).size !== value.userIds.length) {
    ctx.addIssue({ code: 'custom', message: 'مشتری تکراری انتخاب شده است.', path: ['userIds'] });
  }
});
export type SmsCampaignInput = z.infer<typeof smsCampaignInput>;

type Reader = Pick<Db, 'select'>;
type Recipient = { id: number; phone: string; name: string; lastName: string };
export const hashSmsRecipientPhone = (phone: string) => createHmac('sha256', env.APP_SECRET).update(phone).digest('hex');
export function matchesQueuedPhone(currentPhone: string | undefined, queuedHash: string) {
  const normalized = normalizePhone(currentPhone);
  return isValidPhone(normalized) && hashSmsRecipientPhone(normalized) === queuedHash;
}
export function canonicalRecipients(rows: Recipient[]) {
  const seen = new Set<string>();
  return rows.flatMap(row => {
    const phone = normalizePhone(row.phone);
    if (!isValidPhone(phone) || seen.has(phone)) return [];
    seen.add(phone);
    return [{ ...row, phone }];
  });
}

async function recipients(input: SmsCampaignInput, reader: Reader = db) {
  const rows = await reader.select({ id: users.id, phone: users.phone, name: users.name, lastName: users.lastName })
    .from(users).where(and(
      eq(users.role, 'customer'), eq(users.isActive, true), isNull(users.deletedAt),
      input.audience === 'selected' ? inArray(users.id, input.userIds) : undefined,
    )).orderBy(asc(users.id));
  if (input.audience === 'selected' && rows.length !== input.userIds.length) {
    throw badRequest('یکی از مشتریان انتخابی دیگر فعال نیست. فهرست را تازه کنید.');
  }
  return canonicalRecipients(rows);
}

export function previewFingerprint(input: SmsCampaignInput, rows: Pick<Recipient, 'id' | 'phone'>[]) {
  return createHash('sha256').update(JSON.stringify([input.body, input.audience, [...input.userIds].sort((a, b) => a - b), rows.map(r => [r.id, r.phone])])).digest('hex');
}

export async function previewSmsCampaign(input: SmsCampaignInput) {
  const rows = await recipients(input);
  return {
    count: rows.length,
    sample: rows.slice(0, 3).map(r => ({ name: [r.name, r.lastName].filter(Boolean).join(' ') || 'مشتری', phone: `${r.phone.slice(0, 4)}***${r.phone.slice(-4)}` })),
    previewToken: previewFingerprint(input, rows),
  };
}

export async function searchSmsCustomers(q: string) {
  const match = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  return db.select({ id: users.id, phone: users.phone, name: users.name, lastName: users.lastName, storeName: users.storeName })
    .from(users).where(and(eq(users.role, 'customer'), eq(users.isActive, true), isNull(users.deletedAt),
      q ? or(ilike(users.phone, match), ilike(users.name, match), ilike(users.lastName, match), ilike(users.storeName, match)) : undefined))
    .orderBy(desc(users.id)).limit(30);
}

export async function queueSmsCampaign(input: SmsCampaignInput, previewToken: string, requestId: string, actorId: number) {
  return db.transaction(async tx => {
    const [previous] = await tx.select({ id: smsCampaigns.id, total: smsCampaigns.total, createdBy: smsCampaigns.createdBy })
      .from(smsCampaigns).where(eq(smsCampaigns.requestId, requestId)).limit(1);
    if (previous) {
      if (previous.createdBy !== actorId) throw conflict('شناسهٔ درخواست قبلاً استفاده شده است.');
      return { id: previous.id, total: previous.total };
    }
    const rows = await recipients(input, tx);
    if (!rows.length) throw badRequest('مشتری فعال با شمارهٔ معتبر پیدا نشد.');
    if (previewFingerprint(input, rows) !== previewToken) throw conflict('گیرندگان یا متن از زمان پیش‌نمایش تغییر کرده‌اند. پیش‌نمایش را تازه کنید.');
    const [campaign] = await tx.insert(smsCampaigns).values({ requestId, body: input.body, audience: input.audience, total: rows.length, createdBy: actorId }).returning({ id: smsCampaigns.id });
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(smsCampaignDeliveries).values(rows.slice(i, i + 500).map(r => ({ campaignId: campaign!.id, userId: r.id, phoneHash: hashSmsRecipientPhone(r.phone) })));
    }
    return { id: campaign!.id, total: rows.length };
  });
}

export async function listSmsCampaigns() {
  const rows = await db.select().from(smsCampaigns).orderBy(desc(smsCampaigns.id)).limit(30);
  if (!rows.length) return [];
  const stats = await db.select({ campaignId: smsCampaignDeliveries.campaignId, status: smsCampaignDeliveries.status, count: sql<number>`count(*)::int` })
    .from(smsCampaignDeliveries).where(inArray(smsCampaignDeliveries.campaignId, rows.map(r => r.id)))
    .groupBy(smsCampaignDeliveries.campaignId, smsCampaignDeliveries.status);
  return rows.map(row => ({
    ...row,
    stats: Object.fromEntries(stats.filter(s => s.campaignId === row.id).map(s => [s.status, s.count])),
  }));
}

export async function smsCampaignDeliveriesPage(id: number, page: number) {
  const [campaign] = await db.select({ id: smsCampaigns.id }).from(smsCampaigns).where(eq(smsCampaigns.id, id)).limit(1);
  if (!campaign) throw notFound('ارسال پیامک پیدا نشد.');
  const [items, totals] = await Promise.all([
    db.select({ id: smsCampaignDeliveries.id, status: smsCampaignDeliveries.status, error: smsCampaignDeliveries.error,
      sentAt: smsCampaignDeliveries.sentAt, name: users.name, lastName: users.lastName, phone: users.phone })
      .from(smsCampaignDeliveries).leftJoin(users, and(eq(users.id, smsCampaignDeliveries.userId), isNull(users.deletedAt)))
      .where(eq(smsCampaignDeliveries.campaignId, id)).orderBy(asc(smsCampaignDeliveries.id)).limit(30).offset((page - 1) * 30),
    db.select({ count: sql<number>`count(*)::int` }).from(smsCampaignDeliveries).where(eq(smsCampaignDeliveries.campaignId, id)),
  ]);
  return { items: items.map(item => ({ ...item, phone: item.phone ? `${item.phone.slice(0, 4)}***${item.phone.slice(-4)}` : '—' })), total: totals[0]?.count ?? 0, page, perPage: 30 };
}

export async function cancelSmsCampaign(id: number) {
  return db.transaction(async tx => {
    const [row] = await tx.select().from(smsCampaigns).where(eq(smsCampaigns.id, id)).for('update');
    if (!row) throw notFound('ارسال پیامک پیدا نشد.');
    if (!['queued', 'sending'].includes(row.status)) throw conflict('این ارسال دیگر قابل لغو نیست.');
    await tx.update(smsCampaigns).set({ status: 'cancelled', completedAt: new Date() }).where(eq(smsCampaigns.id, id));
    await tx.update(smsCampaignDeliveries).set({ status: 'cancelled' }).where(and(eq(smsCampaignDeliveries.campaignId, id), eq(smsCampaignDeliveries.status, 'queued')));
  });
}

let running = false;
export async function processSmsCampaigns(send: typeof sendSms = sendSms) {
  if (running) return;
  running = true;
  try {
    // A process crash can happen after the provider accepted the SMS. Never resend an uncertain result.
    await db.update(smsCampaignDeliveries).set({ status: 'unknown', error: 'WORKER_INTERRUPTED' })
      .where(and(eq(smsCampaignDeliveries.status, 'processing'), sql`${smsCampaignDeliveries.processingAt} < now() - interval '2 minutes'`));
    const claimed = await db.transaction(async tx => {
      const [campaign] = await tx.select().from(smsCampaigns)
        .where(and(inArray(smsCampaigns.status, ['queued', 'sending']), sql`exists (select 1 from ${smsCampaignDeliveries} where ${smsCampaignDeliveries.campaignId} = ${smsCampaigns.id} and ${smsCampaignDeliveries.status} = 'queued')`))
        .orderBy(asc(smsCampaigns.id)).limit(1).for('update', { skipLocked: true });
      if (!campaign) return null;
      const [delivery] = await tx.select().from(smsCampaignDeliveries)
        .where(and(eq(smsCampaignDeliveries.campaignId, campaign.id), eq(smsCampaignDeliveries.status, 'queued')))
        .orderBy(asc(smsCampaignDeliveries.id)).limit(1).for('update', { skipLocked: true });
      if (!delivery) return null;
      await tx.update(smsCampaignDeliveries).set({ status: 'processing', processingAt: new Date() }).where(eq(smsCampaignDeliveries.id, delivery.id));
      await tx.update(smsCampaigns).set({ status: 'sending' }).where(eq(smsCampaigns.id, campaign.id));
      return { campaign, delivery };
    });
    if (claimed) {
      const { campaign, delivery } = claimed;
      const [currentCampaign, currentUser] = await Promise.all([
        db.select({ status: smsCampaigns.status }).from(smsCampaigns).where(eq(smsCampaigns.id, campaign.id)).limit(1),
        db.select({ phone: users.phone }).from(users).where(and(eq(users.id, delivery.userId!), eq(users.role, 'customer'), eq(users.isActive, true), isNull(users.deletedAt))).limit(1),
      ]);
      let status = 'skipped'; let error: string | null = 'CUSTOMER_CHANGED';
      if (currentCampaign[0]?.status === 'cancelled') { status = 'cancelled'; error = null; }
      else if (currentUser[0] && matchesQueuedPhone(currentUser[0].phone, delivery.phoneHash)) {
        try {
          const result = await send(normalizePhone(currentUser[0].phone), campaign.body);
          status = result.ok ? 'accepted' : 'unknown';
          error = result.ok ? null : 'GATEWAY_RESULT_UNKNOWN';
        } catch { status = 'unknown'; error = 'NETWORK_RESULT_UNKNOWN'; }
      }
      await db.update(smsCampaignDeliveries).set({ status, error, sentAt: status === 'accepted' ? new Date() : null })
        .where(and(eq(smsCampaignDeliveries.id, delivery.id), eq(smsCampaignDeliveries.status, 'processing')));
    }
    await db.update(smsCampaigns).set({ status: 'completed', completedAt: new Date() }).where(and(
      inArray(smsCampaigns.status, ['queued', 'sending']),
      sql`not exists (select 1 from ${smsCampaignDeliveries} where ${smsCampaignDeliveries.campaignId} = ${smsCampaigns.id} and ${smsCampaignDeliveries.status} in ('queued', 'processing'))`,
    ));
  } finally { running = false; }
}
