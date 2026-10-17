import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { normalizePhone } from '@tamas/shared';
import { db } from '../db/client.js';
import { customerBaleAccounts, customerBaleLinkTokens, orders, users, walletAccounts } from '../db/schema.js';
import { randomToken, sha256 } from '../lib/hash.js';
import { generateSecret, getAllSettings, setSetting } from './settings.js';
import type { CustomerTelegramEvent } from './customer-telegram.js';

interface BalePerson { id: number; username?: string; first_name?: string; last_name?: string }
interface BaleMessage {
  chat: { id: number };
  from?: BalePerson;
  text?: string;
  contact?: { phone_number: string; user_id?: number };
}
export interface CustomerBaleUpdate { update_id: number; message?: BaleMessage }

export interface CustomerBaleConfig {
  enabled: boolean;
  botToken: string;
  botUsername: string;
  webhookSecret: string;
  siteUrl: string;
  welcomeMessage: string;
}

const truthy = (value: string | undefined) => value != null && !['', '0', 'false', 'off', 'no'].includes(value.toLowerCase());

export async function getCustomerBaleConfig(): Promise<CustomerBaleConfig> {
  const settings = await getAllSettings();
  return {
    enabled: truthy(settings.CUSTOMER_BALE_ENABLED),
    botToken: (settings.private_CUSTOMER_BALE_BOT_TOKEN ?? '').trim(),
    botUsername: (settings.CUSTOMER_BALE_BOT_USERNAME ?? '').trim().replace(/^@/, ''),
    webhookSecret: (settings.private_CUSTOMER_BALE_WEBHOOK_SECRET ?? '').trim(),
    siteUrl: (settings.CUSTOMER_BALE_SITE_URL ?? settings.CUSTOMER_TELEGRAM_SITE_URL ?? 'https://tamasmarket.com').trim(),
    welcomeMessage: (settings.CUSTOMER_BALE_WELCOME ?? 'به ربات بله تماس مارکت خوش آمدید.').trim(),
  };
}

async function callBaleApi(token: string, method: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`https://tapi.bale.ai/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json() as { ok?: boolean; result?: unknown; description?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.description || `Bale API ${response.status}`);
  return payload;
}

async function sendBaleMessage(chatId: string | number, text: string, keyboard = true): Promise<void> {
  const config = await getCustomerBaleConfig();
  if (!config.enabled || !config.botToken) throw new Error('ربات بله فعال یا تنظیم نشده است.');
  await callBaleApi(config.botToken, 'sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4000),
    ...(keyboard ? { reply_markup: { keyboard: [
      [{ text: '📦 سفارش‌های من' }, { text: '💳 کیف پول' }],
      [{ text: '🛍 ورود به فروشگاه' }, { text: '🔌 قطع اتصال' }],
    ], resize_keyboard: true } } : {}),
  });
}

async function linkByToken(token: string, person: BalePerson, chatId: number): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const [link] = await tx.select().from(customerBaleLinkTokens).where(and(
      eq(customerBaleLinkTokens.tokenHash, sha256(token)), isNull(customerBaleLinkTokens.consumedAt), gt(customerBaleLinkTokens.expiresAt, now),
    )).for('update').limit(1);
    if (!link) throw new Error('لینک اتصال نامعتبر یا منقضی شده است.');
    const baleUserId = String(person.id);
    const [occupied] = await tx.select({ userId: customerBaleAccounts.userId }).from(customerBaleAccounts).where(eq(customerBaleAccounts.baleUserId, baleUserId)).limit(1);
    if (occupied && occupied.userId !== link.userId) throw new Error('این حساب بله قبلاً به مشتری دیگری متصل شده است.');
    await tx.insert(customerBaleAccounts).values({
      userId: link.userId, baleUserId, chatId: String(chatId), username: person.username ?? null,
      firstName: person.first_name ?? null, lastName: person.last_name ?? null, linkedAt: now, lastInteractionAt: now,
    }).onConflictDoUpdate({ target: customerBaleAccounts.userId, set: {
      baleUserId, chatId: String(chatId), username: person.username ?? null, firstName: person.first_name ?? null,
      lastName: person.last_name ?? null, linkedAt: now, lastInteractionAt: now, updatedAt: now,
    } });
    await tx.update(customerBaleLinkTokens).set({ consumedAt: now }).where(eq(customerBaleLinkTokens.id, link.id));
  });
}

async function linkByContact(message: BaleMessage, person: BalePerson): Promise<void> {
  if (!message.contact || (message.contact.user_id != null && message.contact.user_id !== person.id)) throw new Error('لطفاً شماره متعلق به همین حساب بله را ارسال کنید.');
  const phone = normalizePhone(message.contact.phone_number);
  const [user] = await db.select().from(users).where(and(eq(users.phone, phone), isNull(users.deletedAt))).limit(1);
  if (!user) throw new Error('حسابی با این شماره در سایت پیدا نشد.');
  const token = randomToken(18);
  const expiresAt = new Date(Date.now() + 60_000);
  await db.insert(customerBaleLinkTokens).values({ userId: user.id, tokenHash: sha256(token), expiresAt });
  await linkByToken(token, person, message.chat.id);
}

export async function handleCustomerBaleUpdate(update: CustomerBaleUpdate): Promise<void> {
  const message = update.message;
  const person = message?.from;
  if (!message || !person) return;
  try {
    const start = message.text?.match(/^\/start(?:\s+link_([A-Za-z0-9_-]+))?/);
    if (start?.[1]) {
      await linkByToken(start[1], person, message.chat.id);
      const config = await getCustomerBaleConfig();
      await sendBaleMessage(message.chat.id, `✅ حساب شما با موفقیت متصل شد.\n\n${config.welcomeMessage}`);
      return;
    }
    if (message.contact) {
      await linkByContact(message, person);
      await sendBaleMessage(message.chat.id, '✅ حساب شما با موفقیت متصل شد.');
      return;
    }
    const [account] = await db.select().from(customerBaleAccounts).where(eq(customerBaleAccounts.baleUserId, String(person.id))).limit(1);
    if (!account) {
      await sendBaleMessage(message.chat.id, 'برای اتصال امن، از حساب کاربری سایت روی «اتصال به بله» بزنید یا شماره تماس خودتان را با دکمه زیر ارسال کنید.', false);
      await callBaleApi((await getCustomerBaleConfig()).botToken, 'sendMessage', {
        chat_id: message.chat.id, text: 'شماره تماس حساب سایت را ارسال کنید:',
        reply_markup: { keyboard: [[{ text: '📱 اشتراک‌گذاری شماره من', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
      });
      return;
    }
    await db.update(customerBaleAccounts).set({ lastInteractionAt: new Date(), updatedAt: new Date() }).where(eq(customerBaleAccounts.id, account.id));
    const text = message.text ?? '';
    if (text === '🔌 قطع اتصال' || text === '/disconnect') {
      await db.delete(customerBaleAccounts).where(eq(customerBaleAccounts.id, account.id));
      await sendBaleMessage(message.chat.id, 'اتصال حساب بله قطع شد.', false);
    } else if (text === '📦 سفارش‌های من' || text === '/orders') {
      const recent = await db.select().from(orders).where(and(eq(orders.userId, account.userId), isNull(orders.deletedAt))).orderBy(desc(orders.createdAt)).limit(5);
      await sendBaleMessage(message.chat.id, recent.length ? recent.map((order) => `${order.orderCode} — ${order.total.toLocaleString('fa-IR')} تومان — ${order.status}`).join('\n') : 'هنوز سفارشی ندارید.');
    } else if (text === '💳 کیف پول' || text === '/wallet') {
      const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, account.userId)).limit(1);
      await sendBaleMessage(message.chat.id, `موجودی کیف پول: ${(wallet?.balance ?? 0).toLocaleString('fa-IR')} تومان`);
    } else {
      const config = await getCustomerBaleConfig();
      await sendBaleMessage(message.chat.id, `ربات مشتریان تماس مارکت آماده است.\n${config.siteUrl}`);
    }
  } catch (error) {
    await sendBaleMessage(message.chat.id, `❌ ${(error as Error).message}`).catch(() => undefined);
  }
}

export async function createCustomerBaleLink(userId: number): Promise<{ url: string; expiresAt: string }> {
  const config = await getCustomerBaleConfig();
  if (!config.enabled || !config.botToken || !config.botUsername) throw new Error('ربات بله هنوز توسط مدیریت فعال و تکمیل نشده است.');
  const token = randomToken(18);
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.delete(customerBaleLinkTokens).where(eq(customerBaleLinkTokens.userId, userId));
  await db.insert(customerBaleLinkTokens).values({ userId, tokenHash: sha256(token), expiresAt });
  return { url: `https://ble.ir/${config.botUsername}?start=link_${token}`, expiresAt: expiresAt.toISOString() };
}

export async function sendCustomerBaleNotification(userId: number | null | undefined, event: CustomerTelegramEvent, title: string, text: string): Promise<boolean> {
  if (!userId) return false;
  const config = await getCustomerBaleConfig();
  if (!config.enabled || !config.botToken) return false;
  const [account] = await db.select().from(customerBaleAccounts).where(eq(customerBaleAccounts.userId, userId)).limit(1);
  if (!account?.notificationsEnabled || account.notificationPreferences?.[event] === false) return false;
  await sendBaleMessage(account.chatId, `${title}\n\n${text}`);
  return true;
}

export async function testCustomerBaleBot(): Promise<{ botUsername: string }> {
  const config = await getCustomerBaleConfig();
  if (!config.botToken) throw new Error('توکن ربات بله وارد نشده است.');
  const result = await callBaleApi(config.botToken, 'getMe') as { result?: { username?: string } };
  return { botUsername: result.result?.username ?? config.botUsername };
}

export async function configureCustomerBaleWebhook(webhookUrl: string): Promise<{ url: string }> {
  let config = await getCustomerBaleConfig();
  if (!config.botToken) throw new Error('توکن ربات بله وارد نشده است.');
  if (!config.webhookSecret) {
    await setSetting('private_CUSTOMER_BALE_WEBHOOK_SECRET', await generateSecret());
    config = await getCustomerBaleConfig();
  }
  const base = webhookUrl.replace(/\/$/, '');
  const url = base.includes(config.webhookSecret) ? base : `${base}/${config.webhookSecret}`;
  await callBaleApi(config.botToken, 'setWebhook', { url });
  await setSetting('CUSTOMER_BALE_WEBHOOK_URL', base);
  return { url };
}
