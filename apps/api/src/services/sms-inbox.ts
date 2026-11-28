import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { normalizePhone } from '@tamas/shared';
import { db } from '../db/client.js';
import { smsInboxMessages, users } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { offsetOf, paged } from '../lib/pagination.js';
import { getSmsRuntimeConfig, type SmsRuntimeConfig } from './sms-config.js';
import { PAYAMRESAN_V4_BASE_URL, SmsService, type InboxMessage } from './payamresan-v4.js';

const PROVIDER = 'payamresan';

/**
 * Builds the v4 client from the server-side config: the key comes from the
 * encrypted panel setting, else the PAYAMRESAN_API_KEY env var. A configured
 * V3 base URL is for sending only, so the inbox falls back to the v4 host.
 */
export function inboxServiceFromConfig(config: SmsRuntimeConfig['payamresan'], fetchImpl?: typeof fetch): SmsService {
  const configured = config.baseUrl.trim();
  const baseUrl = /^https:\/\/[^/]+\/uapi\/v4\/?$/i.test(configured) ? configured : PAYAMRESAN_V4_BASE_URL;
  return new SmsService(config.apiKey, { baseUrl, fetch: fetchImpl });
}

export async function getInboxService(): Promise<SmsService> {
  return inboxServiceFromConfig((await getSmsRuntimeConfig()).payamresan);
}

/* ------------------------------------------------------------------ *
 * Receiving
 * ------------------------------------------------------------------ */

/** Saves fetched messages; duplicates (same provider id) are skipped. Returns how many were new. */
export async function storeInboxMessages(messages: InboxMessage[], now = new Date()): Promise<number> {
  if (!messages.length) return 0;
  const phones = [...new Set(messages.flatMap((m) => (m.fromMobile ? [normalizePhone(m.fromMobile)] : [])))];
  const owners = phones.length
    ? await db.select({ id: users.id, phone: users.phone }).from(users)
      .where(and(inArray(users.phone, phones), isNull(users.deletedAt)))
    : [];
  const ownerByPhone = new Map(owners.map((u) => [u.phone, u.id]));
  const rows = messages.map((m) => {
    const fromPhone = m.fromMobile ? normalizePhone(m.fromMobile) : null;
    return {
      provider: PROVIDER,
      providerMessageId: m.id.slice(0, 64),
      fromNumber: m.from.slice(0, 32),
      fromPhone,
      toNumber: m.to.slice(0, 32),
      body: m.text,
      providerTime: m.time.slice(0, 40),
      receivedAt: m.receivedAt ?? now,
      userId: fromPhone ? ownerByPhone.get(fromPhone) ?? null : null,
    };
  });
  const inserted = await db.insert(smsInboxMessages).values(rows)
    .onConflictDoNothing({ target: [smsInboxMessages.provider, smsInboxMessages.providerMessageId] })
    .returning({ id: smsInboxMessages.id });
  return inserted.length;
}

export interface InboxPollDeps {
  service: () => Promise<SmsService>;
  store: (messages: InboxMessage[]) => Promise<number>;
}

export interface InboxPollReport {
  skipped?: 'not_configured' | 'running';
  fetched: number;
  stored: number;
  /** Messages fetched but not yet saved (the database failed); retried first next time. */
  pending: number;
}

/**
 * GetInbox hands each message out once, so a fetched batch that the database
 * could not take stays in memory and is saved before the provider is asked
 * again — a DB outage never makes us pull (and drop) more messages.
 */
export function createInboxPoller(deps: InboxPollDeps) {
  let pending: InboxMessage[] = [];
  let running = false;
  return async function poll(): Promise<InboxPollReport> {
    if (running) return { skipped: 'running', fetched: 0, stored: 0, pending: pending.length };
    running = true;
    try {
      let stored = 0;
      if (pending.length) {
        stored += await deps.store(pending);
        pending = [];
      }
      const service = await deps.service();
      if (!service.configured) return { skipped: 'not_configured', fetched: 0, stored, pending: 0 };
      const messages = await service.getInbox();
      try {
        stored += await deps.store(messages);
      } catch (err) {
        pending = messages;
        throw err;
      }
      return { fetched: messages.length, stored, pending: 0 };
    } finally {
      running = false;
    }
  };
}

export const pollSmsInbox = createInboxPoller({ service: getInboxService, store: (m) => storeInboxMessages(m) });

/* ------------------------------------------------------------------ *
 * Admin view
 * ------------------------------------------------------------------ */

export type InboxStatusFilter = 'all' | 'open' | 'handled';

export async function listInboxMessages(params: { q: string; status: InboxStatusFilter; page: number; perPage: number }) {
  // A customer who signs up after texting is still matched by phone.
  const owner = or(
    eq(users.id, smsInboxMessages.userId),
    and(isNull(smsInboxMessages.userId), eq(users.phone, smsInboxMessages.fromPhone), isNull(users.deletedAt)),
  );
  const q = params.q.trim();
  const match = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const phoneQuery = normalizePhone(q);
  const where = and(
    params.status === 'open' ? isNull(smsInboxMessages.handledAt) : params.status === 'handled' ? isNotNull(smsInboxMessages.handledAt) : undefined,
    q ? or(
      ilike(smsInboxMessages.body, match),
      ilike(smsInboxMessages.fromNumber, match),
      ilike(smsInboxMessages.fromPhone, match),
      /^\d{4,}$/.test(phoneQuery) ? ilike(smsInboxMessages.fromPhone, `%${phoneQuery}%`) : undefined,
      ilike(users.name, match),
      ilike(users.lastName, match),
      ilike(users.storeName, match),
    ) : undefined,
  );
  const [items, totalRows, openRows] = await Promise.all([
    db.select({
      id: smsInboxMessages.id,
      fromNumber: smsInboxMessages.fromNumber,
      fromPhone: smsInboxMessages.fromPhone,
      toNumber: smsInboxMessages.toNumber,
      body: smsInboxMessages.body,
      providerTime: smsInboxMessages.providerTime,
      receivedAt: smsInboxMessages.receivedAt,
      handledAt: smsInboxMessages.handledAt,
      userId: users.id,
      userName: users.name,
      userLastName: users.lastName,
      userStoreName: users.storeName,
    }).from(smsInboxMessages).leftJoin(users, owner).where(where)
      .orderBy(desc(smsInboxMessages.receivedAt), desc(smsInboxMessages.id))
      .limit(params.perPage).offset(offsetOf(params)),
    db.select({ total: count() }).from(smsInboxMessages).leftJoin(users, owner).where(where),
    db.select({ open: count() }).from(smsInboxMessages).where(isNull(smsInboxMessages.handledAt)),
  ]);
  return {
    ...paged(items.map(({ userId, userName, userLastName, userStoreName, ...row }) => ({
      ...row,
      customer: userId ? { id: userId, name: [userName, userLastName].filter(Boolean).join(' '), storeName: userStoreName ?? '' } : null,
    })), Number(totalRows[0]?.total ?? 0), params),
    unhandled: Number(openRows[0]?.open ?? 0),
  };
}

export async function setInboxHandled(id: number, handled: boolean, adminId: number): Promise<void> {
  const [row] = await db.update(smsInboxMessages)
    .set(handled ? { handledAt: sql`coalesce(${smsInboxMessages.handledAt}, now())`, handledBy: adminId } : { handledAt: null, handledBy: null })
    .where(eq(smsInboxMessages.id, id))
    .returning({ id: smsInboxMessages.id });
  if (!row) throw notFound('پیامک پیدا نشد.');
}
