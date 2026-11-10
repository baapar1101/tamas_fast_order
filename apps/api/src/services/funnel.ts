import type { FastifyBaseLogger } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import {
  parseFunnelAutomation,
  type FunnelAutomationConfig,
  type FunnelEventType,
  type FunnelMessageKind,
  type FunnelMessageStatsDTO,
  type FunnelReportDTO,
  type FunnelSegment,
  type FunnelStepDTO,
  type FunnelUserRowDTO,
  type SavedCartLineDTO,
} from '@tamas/shared';
import { db, schema } from '../db/client.js';
import { env } from '../env.js';
import { sendCustomerNotification } from './customer-messaging.js';
import type { CustomerTelegramEvent } from './customer-telegram.js';
import { getSetting, setSetting } from './settings.js';
import { sendTemplatedSms } from './sms.js';

const AUTOMATION_KEY = 'funnel_automation';
const HOUR = 60 * 60 * 1000;
/** Follow-ups only go out in daytime, Tehran time. */
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 21;
/** A single pass never sends more than this, so a backlog drains gently. */
const MAX_MESSAGES_PER_RUN = 40;

/* ------------------------------------------------------------------ *
 * Events and saved carts (written by the storefront)
 * ------------------------------------------------------------------ */

export async function recordFunnelEvents(
  visitorId: string,
  userId: number | null,
  events: Array<{ type: FunnelEventType; productId?: string; path?: string }>,
): Promise<number> {
  const seen = new Set<string>();
  const rows = events.filter((event) => {
    const key = `${event.type}:${event.productId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((event) => ({
    visitorId,
    userId,
    type: event.type,
    productId: event.productId || null,
    path: event.path?.split('?')[0]?.slice(0, 300) || null,
  }));
  if (rows.length) await db.insert(schema.funnelEvents).values(rows);
  return rows.length;
}

export async function getSavedCart(userId: number): Promise<SavedCartLineDTO[]> {
  const [row] = await db.select().from(schema.userCarts).where(eq(schema.userCarts.userId, userId)).limit(1);
  return (row?.items as SavedCartLineDTO[] | undefined) ?? [];
}

function cartSignature(items: Array<{ productId: string; warehouse: string; qty: number }>): string {
  return items.map((item) => `${item.productId}:${item.warehouse}:${item.qty}`).sort().join('|');
}

/** Mirrors the browser cart; an empty cart removes the row so no reminder can go out. */
export async function saveUserCart(userId: number, items: SavedCartLineDTO[]): Promise<void> {
  if (items.length === 0) {
    await clearUserCart(userId);
    return;
  }
  const [current] = await db.select().from(schema.userCarts).where(eq(schema.userCarts.userId, userId)).limit(1);
  const unchanged = current && cartSignature(current.items as SavedCartLineDTO[]) === cartSignature(items);
  if (unchanged) return;
  const values = {
    items,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    total: items.reduce((sum, item) => sum + item.qty * item.price, 0),
    updatedAt: new Date(),
    // A changed cart is fresh interest: its reminders start over (the weekly cap still applies).
    remindersSent: 0,
    lastRemindedAt: null,
  };
  await db.insert(schema.userCarts).values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.userCarts.userId, set: values });
}

export async function clearUserCart(userId: number): Promise<void> {
  await db.delete(schema.userCarts).where(eq(schema.userCarts.userId, userId));
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export async function getFunnelAutomation(): Promise<FunnelAutomationConfig> {
  return parseFunnelAutomation(await getSetting(AUTOMATION_KEY));
}

export async function setFunnelAutomation(config: FunnelAutomationConfig): Promise<FunnelAutomationConfig> {
  await setSetting(AUTOMATION_KEY, JSON.stringify(config));
  return config;
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const STEP_LABELS: Record<FunnelStepDTO['key'], string> = {
  visit: 'بازدید از سایت',
  logged_in: 'بازدید با حساب کاربری',
  scroll: 'اسکرول و مرور کالاها',
  product_view: 'مشاهدهٔ صفحهٔ کالا',
  add_to_cart: 'افزودن به سبد خرید',
  checkout_start: 'شروع تکمیل سفارش',
  order: 'ثبت نهایی سفارش',
  paid: 'پرداخت سفارش',
};

type Row = Record<string, unknown>;
const num = (value: unknown) => Number(value ?? 0);
const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

async function rows<T extends Row>(query: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(query)) as unknown as T[];
}

export async function getFunnelReport(days: number): Promise<FunnelReportDTO> {
  const since = new Date(Date.now() - days * 24 * HOUR).toISOString();
  const [events] = await rows<Row>(sql`
    select
      count(distinct coalesce(user_id::text, visitor_id)) filter (where type = 'visit') as visit,
      count(distinct user_id) filter (where type = 'visit') as logged_in,
      count(distinct coalesce(user_id::text, visitor_id)) filter (where type = 'scroll') as scroll,
      count(distinct coalesce(user_id::text, visitor_id)) filter (where type = 'product_view') as product_view,
      count(distinct coalesce(user_id::text, visitor_id)) filter (where type = 'add_to_cart') as add_to_cart,
      count(distinct coalesce(user_id::text, visitor_id)) filter (where type = 'checkout_start') as checkout_start
    from funnel_events where created_at >= ${since}`);
  const [orders] = await rows<Row>(sql`
    select
      count(distinct coalesce(user_id::text, phone)) as orders,
      count(distinct coalesce(user_id::text, phone)) filter (where payment_status = 'paid') as paid
    from orders where created_at >= ${since} and deleted_at is null and status <> 'cancelled'`);
  const [first] = await rows<Row>(sql`select min(created_at) as first from funnel_events`);

  const counts: Record<FunnelStepDTO['key'], number> = {
    visit: num(events?.visit),
    logged_in: num(events?.logged_in),
    scroll: num(events?.scroll),
    product_view: num(events?.product_view),
    add_to_cart: num(events?.add_to_cart),
    checkout_start: num(events?.checkout_start),
    order: num(orders?.orders),
    paid: num(orders?.paid),
  };

  const messageRows = await rows<Row>(sql`
    select m.kind,
      count(*) as sent,
      count(*) filter (where m.delivered) as delivered,
      count(*) filter (where case
        when m.kind = 'unpaid_order' then exists (
          select 1 from orders o where o.id = m.order_id and o.payment_status = 'paid')
        else exists (
          select 1 from orders o where o.user_id = m.user_id and o.deleted_at is null
            and o.created_at > m.created_at and o.created_at <= m.created_at + interval '3 days')
      end) as converted
    from funnel_messages m where m.created_at >= ${since} group by m.kind`);
  const byKind = new Map(messageRows.map((row) => [String(row.kind), row]));
  const messages: FunnelMessageStatsDTO[] = (['cart_reminder_1', 'cart_reminder_2', 'unpaid_order', 'browse_nudge'] as FunnelMessageKind[])
    .map((kind) => ({
      kind,
      sent: num(byKind.get(kind)?.sent),
      delivered: num(byKind.get(kind)?.delivered),
      converted: num(byKind.get(kind)?.converted),
    }));

  return {
    days,
    steps: (Object.keys(STEP_LABELS) as FunnelStepDTO['key'][]).map((key) => ({ key, label: STEP_LABELS[key], people: counts[key] })),
    messages,
    automation: await getFunnelAutomation(),
    trackingSince: iso(first?.first),
  };
}

/* ------------------------------------------------------------------ *
 * Segments: who stopped where
 * ------------------------------------------------------------------ */

function userRow(row: Row): FunnelUserRowDTO {
  return {
    userId: num(row.user_id),
    name: `${row.name ?? ''} ${row.last_name ?? ''}`.trim(),
    phone: String(row.phone ?? ''),
    storeName: String(row.store_name ?? ''),
    lastActivityAt: iso(row.last_activity_at) ?? new Date(0).toISOString(),
    productViews: num(row.product_views),
    scrolls: num(row.scrolls),
    cartItems: num(row.cart_items),
    cartTotal: num(row.cart_total),
    orderId: row.order_id == null ? null : num(row.order_id),
    orderCode: row.order_code == null ? null : String(row.order_code),
    orderTotal: row.order_total == null ? null : num(row.order_total),
    lastMessageAt: iso(row.last_message_at),
    messagesSent: num(row.messages_sent),
  };
}

export async function getFunnelSegment(segment: FunnelSegment, days: number): Promise<FunnelUserRowDTO[]> {
  const since = new Date(Date.now() - days * 24 * HOUR).toISOString();

  if (segment === 'unpaid') {
    return (await rows<Row>(sql`
      select o.user_id, u.name, u.last_name, coalesce(u.phone, o.phone) as phone, coalesce(u.store_name, o.store_name, '') as store_name,
        o.created_at as last_activity_at, o.id as order_id, o.order_code, o.total as order_total,
        (select max(m.created_at) from funnel_messages m where m.order_id = o.id) as last_message_at,
        (select count(*) from funnel_messages m where m.order_id = o.id) as messages_sent
      from orders o left join users u on u.id = o.user_id
      where o.created_at >= ${since} and o.deleted_at is null and o.status <> 'cancelled' and o.payment_status <> 'paid'
      order by o.created_at desc limit 500`)).map(userRow);
  }

  if (segment === 'cart') {
    // Added to cart in the window and has not ordered since the last add.
    return (await rows<Row>(sql`
      with adds as (
        select user_id, max(created_at) as last_add from funnel_events
        where type = 'add_to_cart' and user_id is not null and created_at >= ${since} group by user_id
      )
      select a.user_id, u.name, u.last_name, u.phone, u.store_name,
        greatest(a.last_add, c.updated_at) as last_activity_at,
        coalesce(c.item_count, 0) as cart_items, coalesce(c.total, 0) as cart_total,
        (select max(m.created_at) from funnel_messages m where m.user_id = a.user_id and m.kind like 'cart_%') as last_message_at,
        (select count(*) from funnel_messages m where m.user_id = a.user_id and m.kind like 'cart_%' and m.created_at >= ${since}) as messages_sent
      from adds a join users u on u.id = a.user_id
      left join user_carts c on c.user_id = a.user_id
      where not exists (select 1 from orders o where o.user_id = a.user_id and o.deleted_at is null and o.created_at >= a.last_add)
      order by last_activity_at desc limit 500`)).map(userRow);
  }

  // Browsed: logged in and looked at products, but added nothing and ordered nothing in the window.
  return (await rows<Row>(sql`
    with browsing as (
      select user_id, max(created_at) as last_activity_at,
        count(*) filter (where type = 'product_view') as product_views,
        count(*) filter (where type = 'scroll') as scrolls
      from funnel_events
      where user_id is not null and created_at >= ${since} and type in ('visit', 'scroll', 'product_view')
      group by user_id
    )
    select b.user_id, u.name, u.last_name, u.phone, u.store_name, b.last_activity_at, b.product_views, b.scrolls,
      (select max(m.created_at) from funnel_messages m where m.user_id = b.user_id and m.kind = 'browse_nudge') as last_message_at,
      (select count(*) from funnel_messages m where m.user_id = b.user_id and m.kind = 'browse_nudge' and m.created_at >= ${since}) as messages_sent
    from browsing b join users u on u.id = b.user_id
    where u.role = 'customer'
      and (b.scrolls > 0 or b.product_views > 0)
      and not exists (select 1 from funnel_events e where e.user_id = b.user_id and e.type = 'add_to_cart' and e.created_at >= ${since})
      and not exists (select 1 from orders o where o.user_id = b.user_id and o.deleted_at is null and o.created_at >= ${since})
    order by b.last_activity_at desc limit 500`)).map(userRow);
}

/* ------------------------------------------------------------------ *
 * Automatic follow-ups
 * ------------------------------------------------------------------ */

export function tehranHour(value = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', hourCycle: 'h23' }).format(value));
}

export function isSendingHour(value = new Date()): boolean {
  const hour = tehranHour(value);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

const fa = (value: number) => Math.round(value).toLocaleString('fa-IR');

interface FollowUp {
  event: CustomerTelegramEvent;
  title: string;
  text: string;
  smsTemplate: string;
  smsVariables: Record<string, string>;
  smsDefault: string;
}

export function followUpMessage(
  kind: FunnelMessageKind,
  input: { name: string; items?: number; total?: number; orderCode?: string },
  siteUrl = env.PUBLIC_SITE_URL,
): FollowUp {
  const site = siteUrl.replace(/\/$/, '');
  const greeting = input.name ? `${input.name} عزیز، ` : 'همکار گرامی، ';
  const smsGreeting = input.name ? `${input.name} عزیز` : 'همکار گرامی';
  const items = fa(input.items ?? 0);
  const total = fa(input.total ?? 0);
  switch (kind) {
    case 'cart_reminder_1':
      return {
        event: 'cart.reminder',
        title: '🛒 سبد خرید شما منتظر ثبت است',
        text: `${greeting}${items} کالا به ارزش ${total} تومان در سبد خرید شما در تماس مارکت مانده است. موجودی کالاهای جشنواره محدود است؛ برای ثبت سفارش:\n${site}/checkout`,
        smsTemplate: 'sms_template_cart_reminder',
        smsVariables: { name: smsGreeting, items, total, link: `${site}/checkout` },
        smsDefault: '{name}، {items} کالا به ارزش {total} تومان در سبد خرید شما در تماس مارکت مانده است. ثبت سفارش: {link}',
      };
    case 'cart_reminder_2':
      return {
        event: 'cart.reminder',
        title: '⏳ کالاهای سبد شما هنوز رزرو نشده‌اند',
        text: `${greeting}کالاهای سبد خرید شما (${items} کالا، ${total} تومان) تا ثبت سفارش رزرو نمی‌شوند و ممکن است تمام شوند. برای نهایی‌کردن سفارش:\n${site}/checkout`,
        smsTemplate: 'sms_template_cart_reminder',
        smsVariables: { name: smsGreeting, items, total, link: `${site}/checkout` },
        smsDefault: '{name}، کالاهای سبد خرید شما در تماس مارکت ({items} کالا) هنوز ثبت نشده‌اند و ممکن است تمام شوند. ثبت سفارش: {link}',
      };
    case 'unpaid_order':
      return {
        event: 'order.payment_reminder',
        title: `💳 پرداخت سفارش ${input.orderCode ?? ''} انجام نشده است`,
        text: `${greeting}سفارش ${input.orderCode ?? ''} به مبلغ ${total} تومان ثبت شده ولی هنوز پرداخت نشده است. برای نهایی‌شدن و ارسال سفارش، پرداخت را از حساب کاربری انجام دهید:\n${site}/account`,
        smsTemplate: 'sms_template_unpaid_order',
        smsVariables: { name: smsGreeting, order: input.orderCode ?? '', total, link: `${site}/account` },
        smsDefault: '{name}، سفارش {order} به مبلغ {total} تومان در تماس مارکت هنوز پرداخت نشده است. پرداخت: {link}',
      };
    case 'browse_nudge':
      return {
        event: 'promotion',
        title: '🎁 کالاهای جشنواره تماس مارکت',
        text: `${greeting}کالاهای جشنوارهٔ تماس مارکت با قیمت ویژه و موجودی محدود در سایت هستند. برای دیدن و سفارش:\n${site}`,
        smsTemplate: 'sms_template_browse_nudge',
        smsVariables: { name: smsGreeting, link: site },
        smsDefault: '{name}، کالاهای جشنواره تماس مارکت با قیمت ویژه و موجودی محدود در سایت هستند: {link}',
      };
  }
}

async function deliver(
  config: FunnelAutomationConfig,
  messageId: number,
  user: { id: number; phone: string },
  followUp: FollowUp,
): Promise<boolean> {
  const channels: string[] = [];
  const bots = await sendCustomerNotification(user.id, followUp.event, followUp.title, followUp.text)
    .catch(() => ({ telegram: false, bale: false }));
  if (bots.telegram) channels.push('telegram');
  if (bots.bale) channels.push('bale');
  if (!channels.length && config.smsFallback && user.phone) {
    const sms = await sendTemplatedSms(user.phone, followUp.smsTemplate, followUp.smsVariables, followUp.smsDefault)
      .catch((error: unknown) => ({ ok: false, error: String(error) }));
    // `ok` with an `error` means SMS for this event is switched off.
    if (sms.ok && !sms.error) channels.push('sms');
  }
  await db.update(schema.funnelMessages)
    .set({ channels: channels.join(','), delivered: channels.length > 0 })
    .where(eq(schema.funnelMessages.id, messageId));
  return channels.length > 0;
}

interface CandidateUser extends Row {
  user_id: number;
  phone: string;
  name: string;
}

async function cartCandidates(stage: 1 | 2, limit: number): Promise<Array<CandidateUser & { item_count: number; total: number }>> {
  const now = Date.now();
  const due = new Date(now - (stage === 1 ? 1 : 24) * HOUR).toISOString();
  const oldest = new Date(now - (stage === 1 ? 3 : 7) * 24 * HOUR).toISOString();
  const lastReminderBefore = new Date(now - 12 * HOUR).toISOString();
  const weekAgo = new Date(now - 7 * 24 * HOUR).toISOString();
  return rows(sql`
    select c.user_id, u.phone, u.name, c.item_count, c.total
    from user_carts c join users u on u.id = c.user_id
    where c.item_count > 0 and u.is_active and u.role = 'customer' and u.deleted_at is null
      and c.reminders_sent = ${stage - 1}
      and c.updated_at <= ${due} and c.updated_at >= ${oldest}
      and (${stage} = 1 or c.last_reminded_at <= ${lastReminderBefore})
      and not exists (select 1 from orders o where o.user_id = c.user_id and o.deleted_at is null
        and o.created_at >= c.updated_at - interval '10 minutes')
      and (select count(*) from funnel_messages m where m.user_id = c.user_id
        and m.kind like 'cart_%' and m.created_at >= ${weekAgo}) < 2
    order by c.updated_at limit ${limit}`);
}

async function unpaidCandidates(limit: number): Promise<Array<CandidateUser & { order_id: number; order_code: string; total: number }>> {
  const now = Date.now();
  return rows(sql`
    select o.user_id, coalesce(u.phone, o.phone) as phone, u.name, o.id as order_id, o.order_code, o.total
    from orders o join users u on u.id = o.user_id
    where o.payment_status = 'unpaid' and o.status = 'new' and o.deleted_at is null and o.total > 0
      and o.created_at <= ${new Date(now - 2 * HOUR).toISOString()} and o.created_at >= ${new Date(now - 48 * HOUR).toISOString()}
      and (o.payment_plan is null or o.payment_plan->>'kind' = 'cash')
      and coalesce(o.note, '') not like '%اطلاعات پرداخت%'
      and not exists (select 1 from funnel_messages m where m.order_id = o.id and m.kind = 'unpaid_order')
    order by o.created_at limit ${limit}`);
}

async function browseCandidates(limit: number): Promise<CandidateUser[]> {
  const now = Date.now();
  return rows(sql`
    with browsing as (
      select user_id, max(created_at) as last_seen from funnel_events
      where user_id is not null and type in ('scroll', 'product_view') and created_at >= ${new Date(now - 48 * HOUR).toISOString()}
      group by user_id
    )
    select b.user_id, u.phone, u.name
    from browsing b join users u on u.id = b.user_id
    where b.last_seen <= ${new Date(now - 3 * HOUR).toISOString()}
      and u.is_active and u.role = 'customer' and u.deleted_at is null
      and not exists (select 1 from funnel_events e where e.user_id = b.user_id and e.type = 'add_to_cart'
        and e.created_at >= ${new Date(now - 7 * 24 * HOUR).toISOString()})
      and not exists (select 1 from user_carts c where c.user_id = b.user_id and c.item_count > 0)
      and not exists (select 1 from orders o where o.user_id = b.user_id and o.deleted_at is null
        and o.created_at >= ${new Date(now - 7 * 24 * HOUR).toISOString()})
      and not exists (select 1 from funnel_messages m where m.user_id = b.user_id and m.kind = 'browse_nudge'
        and m.created_at >= ${new Date(now - 7 * 24 * HOUR).toISOString()})
    order by b.last_seen limit ${limit}`);
}

/** One pass of the automatic follow-ups; safe to call often, it sends nothing twice. */
export async function runFunnelAutomation(log?: FastifyBaseLogger, now = new Date()): Promise<Record<FunnelMessageKind, number>> {
  const sent: Record<FunnelMessageKind, number> = { cart_reminder_1: 0, cart_reminder_2: 0, unpaid_order: 0, browse_nudge: 0 };
  if (!isSendingHour(now)) return sent;
  const config = await getFunnelAutomation();
  let budget = MAX_MESSAGES_PER_RUN;

  if (config.unpaidOrder && budget > 0) {
    for (const row of await unpaidCandidates(budget)) {
      const [message] = await db.insert(schema.funnelMessages)
        .values({ userId: row.user_id, kind: 'unpaid_order', orderId: row.order_id })
        .onConflictDoNothing().returning({ id: schema.funnelMessages.id });
      if (!message) continue;
      await deliver(config, message.id, { id: row.user_id, phone: row.phone },
        followUpMessage('unpaid_order', { name: row.name, orderCode: row.order_code, total: num(row.total) }));
      sent.unpaid_order += 1;
      budget -= 1;
    }
  }

  if (config.abandonedCart) {
    for (const stage of [1, 2] as const) {
      if (budget <= 0) break;
      const kind: FunnelMessageKind = stage === 1 ? 'cart_reminder_1' : 'cart_reminder_2';
      for (const row of await cartCandidates(stage, budget)) {
        // Claim the cart first so a parallel pass cannot send the same reminder.
        const claimed = await db.update(schema.userCarts)
          .set({ remindersSent: stage, lastRemindedAt: new Date() })
          .where(sql`${schema.userCarts.userId} = ${row.user_id} and ${schema.userCarts.remindersSent} = ${stage - 1}`)
          .returning({ userId: schema.userCarts.userId });
        if (!claimed.length) continue;
        const [message] = await db.insert(schema.funnelMessages)
          .values({ userId: row.user_id, kind }).returning({ id: schema.funnelMessages.id });
        await deliver(config, message!.id, { id: row.user_id, phone: row.phone },
          followUpMessage(kind, { name: row.name, items: num(row.item_count), total: num(row.total) }));
        sent[kind] += 1;
        budget -= 1;
      }
    }
  }

  if (config.browseNudge && budget > 0) {
    for (const row of await browseCandidates(budget)) {
      const [message] = await db.insert(schema.funnelMessages)
        .values({ userId: row.user_id, kind: 'browse_nudge' }).returning({ id: schema.funnelMessages.id });
      await deliver(config, message!.id, { id: row.user_id, phone: row.phone },
        followUpMessage('browse_nudge', { name: row.name }));
      sent.browse_nudge += 1;
      budget -= 1;
    }
  }

  const total = Object.values(sent).reduce((sum, value) => sum + value, 0);
  if (total > 0) log?.info({ sent }, 'sales funnel follow-ups sent');
  return sent;
}

/** Old raw events are only needed for the 30-day report. */
export async function pruneFunnelEvents(): Promise<void> {
  await db.execute(sql`delete from funnel_events where created_at < now() - interval '120 days'`);
}
