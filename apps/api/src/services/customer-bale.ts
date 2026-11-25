import { and, eq, gt, isNull } from 'drizzle-orm';
import { normalizePhone } from '@tamas/shared';
import { db } from '../db/client.js';
import { customerBaleAccounts, customerBaleLinkTokens } from '../db/schema.js';
import { randomToken, sha256 } from '../lib/hash.js';
import { generateSecret, getAllSettings, setSetting } from './settings.js';
import type { CustomerTelegramEvent } from './customer-telegram.js';
import {
  BOT_CALLBACK_PREFIX,
  handleCustomerBotInput,
  type BotChannel,
  type BotIncoming,
  type BotSendOptions,
  type BotTransport,
  type CustomerBotDeps,
} from './customer-bot.js';

interface BalePerson { id: number; username?: string; first_name?: string; last_name?: string }
interface BaleMessage {
  chat: { id: number; type?: string };
  from?: BalePerson;
  text?: string;
  caption?: string;
  contact?: { phone_number: string; user_id?: number };
  photo?: Array<{ file_id: string; file_size?: number }>;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
}
interface BaleCallback { id: string; from: BalePerson; data?: string; message?: BaleMessage }
export interface CustomerBaleUpdate { update_id: number; message?: BaleMessage; callback_query?: BaleCallback }

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

/** Labels of the reply keyboard older Bale chats still show. */
const LEGACY_KEYBOARD: Record<string, string> = {
  '📦 سفارش‌های من': '/orders',
  '💳 کیف پول': '/wallet',
  '🛍 ورود به فروشگاه': '/menu',
};

/** Bale's support for HTML formatting is not guaranteed, so the engine's markup becomes plain text. */
export function baleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .slice(0, 4000);
}

function baleReplyMarkup(options: BotSendOptions | undefined): Record<string, unknown> {
  if (options?.contactButton) {
    return { reply_markup: { keyboard: [[{ text: options.contactButton, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };
  }
  if (options?.buttons?.length) {
    return { reply_markup: { inline_keyboard: options.buttons.map((row) => row.map((button) => ({
      text: button.text,
      ...(button.data ? { callback_data: button.data } : {}),
      ...(button.url ? { url: button.url } : {}),
    }))) } };
  }
  if (options?.removeKeyboard) return { reply_markup: { remove_keyboard: true } };
  return {};
}

async function sendBaleMessage(chatId: string | number, text: string, options?: BotSendOptions): Promise<void> {
  const config = await getCustomerBaleConfig();
  if (!config.enabled || !config.botToken) throw new Error('ربات بله فعال یا تنظیم نشده است.');
  await callBaleApi(config.botToken, 'sendMessage', { chat_id: chatId, text: baleText(text), ...baleReplyMarkup(options) });
}

async function downloadBaleFile(token: string, fileId: string, maxBytes: number): Promise<Buffer> {
  const info = await callBaleApi(token, 'getFile', { file_id: fileId }) as { result?: { file_path?: string; file_size?: number } };
  const path = info.result?.file_path;
  if (!path) throw new Error('بله فایل را برنگرداند.');
  if ((info.result?.file_size ?? 0) > maxBytes) throw new Error('حجم فایل بیشتر از حد مجاز است.');
  const response = await fetch(`https://tapi.bale.ai/file/bot${token}/${path}`);
  if (!response.ok) throw new Error(`دریافت فایل از بله ناموفق بود (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) throw new Error('حجم فایل بیشتر از حد مجاز است.');
  return buffer;
}

function baleTransport(config: CustomerBaleConfig): BotTransport {
  return {
    send: (chatId, html, options) => sendBaleMessage(chatId, html, options),
    async sendPhoto(chatId, photoUrl, captionHtml, options) {
      await callBaleApi(config.botToken, 'sendPhoto', { chat_id: chatId, photo: photoUrl, caption: baleText(captionHtml).slice(0, 1024), ...baleReplyMarkup(options) });
    },
    async download(fileId) {
      return { buffer: await downloadBaleFile(config.botToken, fileId, 15 * 1024 * 1024) };
    },
  };
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

/** Links a Bale user to a site account after the engine verified the login. */
async function linkBaleAccount(userId: number, person: BalePerson, chatId: number): Promise<void> {
  const now = new Date();
  const baleUserId = String(person.id);
  await db.transaction(async (tx) => {
    const [occupied] = await tx.select({ userId: customerBaleAccounts.userId }).from(customerBaleAccounts).where(eq(customerBaleAccounts.baleUserId, baleUserId)).limit(1);
    if (occupied && occupied.userId !== userId) throw new Error('این حساب بله قبلاً به مشتری دیگری متصل شده است. ابتدا اتصال قبلی را قطع کنید.');
    await tx.insert(customerBaleAccounts).values({
      userId, baleUserId, chatId: String(chatId), username: person.username ?? null,
      firstName: person.first_name ?? null, lastName: person.last_name ?? null, linkedAt: now, lastInteractionAt: now,
    }).onConflictDoUpdate({ target: customerBaleAccounts.userId, set: {
      baleUserId, chatId: String(chatId), username: person.username ?? null, firstName: person.first_name ?? null,
      lastName: person.last_name ?? null, linkedAt: now, lastInteractionAt: now, updatedAt: now,
    } });
  });
}

async function linkedBaleAccount(baleUserId: number) {
  const [account] = await db.select().from(customerBaleAccounts).where(eq(customerBaleAccounts.baleUserId, String(baleUserId))).limit(1);
  return account ?? null;
}

/** Turns a Bale update into the shared engine's input. */
export function toBaleBotIncoming(person: { id: number }, chatId: number, message: BaleMessage | undefined, callbackData: string | undefined): BotIncoming {
  const incoming: BotIncoming = { botUserId: String(person.id), chatId: String(chatId) };
  if (callbackData) return { ...incoming, callbackData };
  if (!message) return incoming;
  if (message.contact) {
    // Only a contact Bale marks as the sender's own skips the SMS code.
    return message.contact.user_id === person.id
      ? { ...incoming, ownContactPhone: normalizePhone(message.contact.phone_number) }
      : { ...incoming, text: message.contact.phone_number };
  }
  const photo = message.photo?.length ? message.photo[message.photo.length - 1] : undefined;
  if (photo) return { ...incoming, file: { fileId: photo.file_id, photo: true, size: photo.file_size } };
  if (message.document) {
    return { ...incoming, file: { fileId: message.document.file_id, photo: false, mimeType: message.document.mime_type, fileName: message.document.file_name, size: message.document.file_size } };
  }
  const text = message.text ?? message.caption ?? '';
  return { ...incoming, text: LEGACY_KEYBOARD[text] ?? text };
}

let customerBotDeps: Promise<CustomerBotDeps> | null = null;
function botDeps(): Promise<CustomerBotDeps> {
  customerBotDeps ??= import('./customer-bot-deps.js')
    .then(({ createCustomerBotDeps }) => createCustomerBotDeps())
    .catch((error: unknown) => {
      customerBotDeps = null; // retry on the next update instead of failing until restart
      throw error;
    });
  return customerBotDeps;
}

const BALE_MENU_ROWS = [[{ text: '🔌 قطع اتصال', data: 'cbale:disconnect' }]];

export async function handleCustomerBaleUpdate(update: CustomerBaleUpdate): Promise<void> {
  const message = update.message;
  const callback = update.callback_query;
  const person = message?.from ?? callback?.from;
  const chatId = message?.chat.id ?? callback?.message?.chat.id;
  if (!person || !chatId) return;
  try {
    const chatType = message?.chat.type ?? callback?.message?.chat.type;
    if (chatType && chatType !== 'private') throw new Error('برای حفظ حریم خصوصی، ربات مشتریان فقط در گفت‌وگوی خصوصی قابل استفاده است.');
    const config = await getCustomerBaleConfig();
    if (!config.enabled || !config.botToken) return;
    if (callback) await callBaleApi(config.botToken, 'answerCallbackQuery', { callback_query_id: callback.id }).catch(() => undefined);

    const start = message?.text?.match(/^\/start(?:\s+link_([A-Za-z0-9_-]+))?/);
    if (start?.[1]) {
      await linkByToken(start[1], person, chatId);
      await sendBaleMessage(chatId, `✅ حساب شما با موفقیت متصل شد.\n\n${config.welcomeMessage}`);
    }

    let account = await linkedBaleAccount(person.id);
    if (account) {
      await db.update(customerBaleAccounts).set({ lastInteractionAt: new Date(), updatedAt: new Date() }).where(eq(customerBaleAccounts.id, account.id));
    }
    const text = message?.text ?? '';
    if (account && (text === '🔌 قطع اتصال' || text === '/disconnect' || callback?.data === 'cbale:disconnect')) {
      await db.delete(customerBaleAccounts).where(eq(customerBaleAccounts.id, account.id));
      await sendBaleMessage(chatId, 'اتصال حساب بله قطع شد. برای اتصال دوباره /start را بزنید.', { removeKeyboard: true });
      return;
    }

    const channel: BotChannel = {
      platform: 'bale',
      transport: baleTransport(config),
      siteUrl: config.siteUrl,
      extraMenuRows: BALE_MENU_ROWS,
      linkedUserId: async () => account?.userId ?? null,
      link: async (userId) => {
        await linkBaleAccount(userId, person, chatId);
        account = await linkedBaleAccount(person.id);
      },
    };
    const data = callback?.data?.startsWith(BOT_CALLBACK_PREFIX) ? callback.data : callback ? `${BOT_CALLBACK_PREFIX}m` : undefined;
    await handleCustomerBotInput(channel, toBaleBotIncoming(person, chatId, message, data), await botDeps());
  } catch (error) {
    await sendBaleMessage(chatId, `❌ ${(error as Error).message || 'عملیات انجام نشد.'}`).catch(() => undefined);
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
  await sendBaleMessage(account.chatId, `${title}\n\n${text}`, { buttons: [[{ text: '📦 سفارش‌های من', data: `${BOT_CALLBACK_PREFIX}o` }, { text: '🏠 منوی اصلی', data: `${BOT_CALLBACK_PREFIX}m` }]] });
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
