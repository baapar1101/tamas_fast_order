import { and, eq, gt, isNull } from 'drizzle-orm';
import { normalizePhone } from '@tamas/shared';
import { db } from '../db/client.js';
import {
  customerTelegramAccounts,
  customerTelegramLinkTokens,
} from '../db/schema.js';
import { randomToken, sha256 } from '../lib/hash.js';
import { callTelegramApi, downloadTelegramBotFile } from './telegram.js';
import { generateSecret, getAllSettings, setSetting } from './settings.js';
import { normalizeTelegramBotUsername, parseCustomerTelegramLinkToken, telegramContactBelongsToSender } from './customer-telegram-model.js';
import {
  BOT_CALLBACK_PREFIX,
  handleCustomerBotInput,
  type BotChannel,
  type BotIncoming,
  type BotSendOptions,
  type BotTransport,
  type CustomerBotDeps,
} from './customer-bot.js';

export const CUSTOMER_TELEGRAM_EVENTS = [
  'order.created',
  'order.status_changed',
  'order.items_changed',
  'payment.paid',
  'payment.failed',
  'credit.application_status_changed',
  'credit.document_reupload_requested',
  'credit.cheque_status_changed',
  'credit.installment_receipt_reminder',
  'credit.installment_receipt_status_changed',
  'wallet.changed',
  'payment.instructions_ready',
  'discount.created',
  'cart.reminder',
  'order.payment_reminder',
  'promotion',
] as const;

export type CustomerTelegramEvent = (typeof CUSTOMER_TELEGRAM_EVENTS)[number];

export interface CustomerTelegramConfig {
  enabled: boolean;
  botToken: string;
  botUsername: string;
  proxyUrl: string;
  webhookSecret: string;
  webhookUrl: string;
  welcomeMessage: string;
  supportUrl: string;
  siteUrl: string;
  popupTitle: string;
  popupText: string;
  popupButton: string;
  events: Record<CustomerTelegramEvent, boolean>;
}

interface TelegramPerson {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type?: string };
  from?: TelegramPerson;
  text?: string;
  caption?: string;
  contact?: { phone_number: string; user_id?: number; first_name?: string; last_name?: string };
  photo?: Array<{ file_id: string; file_size?: number; width?: number; height?: number }>;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
}

interface TelegramCallback {
  id: string;
  from: TelegramPerson;
  data?: string;
  message?: TelegramMessage;
}

export interface CustomerTelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
}

const DEFAULT_EVENTS = Object.fromEntries(CUSTOMER_TELEGRAM_EVENTS.map((event) => [event, true])) as Record<CustomerTelegramEvent, boolean>;

function bool(value: string | undefined): boolean {
  return value != null && !['', '0', 'false', 'off', 'no'].includes(value.toLowerCase());
}

function parseEvents(value: string | undefined): Record<CustomerTelegramEvent, boolean> {
  if (!value) return { ...DEFAULT_EVENTS };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(CUSTOMER_TELEGRAM_EVENTS.map((event) => [event, parsed[event] !== false])) as Record<CustomerTelegramEvent, boolean>;
  } catch {
    return { ...DEFAULT_EVENTS };
  }
}

export async function getCustomerTelegramConfig(): Promise<CustomerTelegramConfig> {
  const config = await getAllSettings();
  return {
    enabled: bool(config.CUSTOMER_TELEGRAM_ENABLED),
    botToken: (config.private_CUSTOMER_TELEGRAM_BOT_TOKEN ?? '').trim(),
    botUsername: normalizeTelegramBotUsername(config.CUSTOMER_TELEGRAM_BOT_USERNAME),
    proxyUrl: (config.CUSTOMER_TELEGRAM_PROXY_URL ?? config.TELEGRAM_PROXY_URL ?? '').trim(),
    webhookSecret: (config.private_CUSTOMER_TELEGRAM_WEBHOOK_SECRET ?? '').trim(),
    webhookUrl: (config.CUSTOMER_TELEGRAM_WEBHOOK_URL ?? '').trim(),
    welcomeMessage: (config.CUSTOMER_TELEGRAM_WELCOME ?? 'به ربات مشتریان تماس مارکت خوش آمدید. از اینجا سفارش‌ها، پرداخت‌ها، اعتبار و کیف پول خود را پیگیری کنید.').trim(),
    supportUrl: (config.CUSTOMER_TELEGRAM_SUPPORT_URL ?? '').trim(),
    siteUrl: (config.CUSTOMER_TELEGRAM_SITE_URL ?? 'https://tamasmarket.com').trim().replace(/\/$/, ''),
    popupTitle: (config.CUSTOMER_TELEGRAM_POPUP_TITLE ?? 'اتصال به ربات تلگرام تماس مارکت').trim(),
    popupText: (config.CUSTOMER_TELEGRAM_POPUP_TEXT ?? 'برای دریافت وضعیت سفارش، پرداخت و اعتبار، حساب خود را به ربات رسمی تماس مارکت متصل کنید.').trim(),
    popupButton: (config.CUSTOMER_TELEGRAM_POPUP_BUTTON ?? 'اتصال امن به تلگرام').trim(),
    events: parseEvents(config.CUSTOMER_TELEGRAM_NOTIFICATION_EVENTS),
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function inlineKeyboard(rows: Array<Array<{ text: string; data?: string; url?: string }>>): Record<string, unknown> {
  return { inline_keyboard: rows.map((row) => row.map((button) => ({ text: button.text, ...(button.data ? { callback_data: button.data } : {}), ...(button.url ? { url: button.url } : {}) }))) };
}

async function sendCustomerBotMessage(chatId: string | number, text: string, replyMarkup?: Record<string, unknown>): Promise<void> {
  const config = await getCustomerTelegramConfig();
  if (!config.enabled || !config.botToken) throw new Error('ربات مشتریان فعال یا تنظیم نشده است.');
  await callTelegramApi(config.botToken, 'sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4096),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  }, config.proxyUrl);
}

/** Stops the button's loading spinner; without text Telegram shows no toast. */
async function answerCallback(id: string, text = ''): Promise<void> {
  const config = await getCustomerTelegramConfig();
  if (!config.botToken) return;
  await callTelegramApi(config.botToken, 'answerCallbackQuery', { callback_query_id: id, ...(text ? { text: text.slice(0, 180) } : {}) }, config.proxyUrl);
}

/** Buttons under notifications and broadcasts: shortcuts into the customer bot. */
function mainMenu(config: CustomerTelegramConfig): Record<string, unknown> {
  const rows = [
    [{ text: '📦 سفارش‌های من', data: `${BOT_CALLBACK_PREFIX}o` }, { text: '🛒 سبد خرید', data: `${BOT_CALLBACK_PREFIX}cart` }],
    [{ text: '🛍 محصولات', data: `${BOT_CALLBACK_PREFIX}cat` }, { text: '🏠 منوی اصلی', data: `${BOT_CALLBACK_PREFIX}m` }],
    [{ text: '🌐 ورود به فروشگاه', url: config.siteUrl }],
  ];
  if (config.supportUrl) rows.push([{ text: '💬 پشتیبانی', url: config.supportUrl }]);
  return inlineKeyboard(rows);
}

/** Notification settings and disconnect stay Telegram-specific; everything else is the shared engine. */
const TELEGRAM_MENU_ROWS = [[
  { text: '🔔 تنظیم اعلان‌ها', data: 'ctg:notifications' },
  { text: '🔌 قطع اتصال', data: 'ctg:disconnect' },
]];

/** Callback data of messages sent before the shared engine existed. */
const LEGACY_ACTIONS: Record<string, string> = {
  orders: 'o', wallet: 'w', credit: 'cr', profile: 'pf', help: 'help', menu: 'm',
};

function telegramReplyMarkup(options: BotSendOptions | undefined): Record<string, unknown> {
  if (options?.contactButton) {
    return { reply_markup: { keyboard: [[{ text: options.contactButton, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } };
  }
  if (options?.buttons?.length) return { reply_markup: inlineKeyboard(options.buttons) };
  if (options?.removeKeyboard) return { reply_markup: { remove_keyboard: true } };
  return {};
}

function telegramTransport(config: CustomerTelegramConfig): BotTransport {
  return {
    async send(chatId, html, options) {
      await callTelegramApi(config.botToken, 'sendMessage', {
        chat_id: chatId,
        text: html.slice(0, 4096),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...telegramReplyMarkup(options),
      }, config.proxyUrl);
    },
    async sendPhoto(chatId, photoUrl, captionHtml, options) {
      await callTelegramApi(config.botToken, 'sendPhoto', {
        chat_id: chatId,
        photo: photoUrl,
        caption: captionHtml.slice(0, 1024),
        parse_mode: 'HTML',
        ...telegramReplyMarkup(options),
      }, config.proxyUrl);
    },
    async download(fileId) {
      return { buffer: await downloadTelegramBotFile(config, fileId, 15 * 1024 * 1024) };
    },
  };
}

async function linkedAccount(telegramUserId: number) {
  const [account] = await db.select().from(customerTelegramAccounts)
    .where(eq(customerTelegramAccounts.telegramUserId, String(telegramUserId))).limit(1);
  return account ?? null;
}

async function touchAccount(id: number): Promise<void> {
  await db.update(customerTelegramAccounts).set({ lastInteractionAt: new Date(), updatedAt: new Date() }).where(eq(customerTelegramAccounts.id, id));
}

async function linkAccount(userId: number, person: TelegramPerson, chatId: number): Promise<void> {
  const telegramUserId = String(person.id);
  await db.transaction(async (tx) => {
    const [occupied] = await tx.select({ userId: customerTelegramAccounts.userId }).from(customerTelegramAccounts)
      .where(eq(customerTelegramAccounts.telegramUserId, telegramUserId)).limit(1);
    if (occupied && occupied.userId !== userId) throw new Error('این حساب تلگرام قبلاً به حساب دیگری متصل شده است.');
    const now = new Date();
    await tx.insert(customerTelegramAccounts).values({
      userId,
      telegramUserId,
      chatId: String(chatId),
      username: person.username ?? null,
      firstName: person.first_name ?? null,
      lastName: person.last_name ?? null,
      linkedAt: now,
      lastInteractionAt: now,
    }).onConflictDoUpdate({
      target: customerTelegramAccounts.userId,
      set: { telegramUserId, chatId: String(chatId), username: person.username ?? null, firstName: person.first_name ?? null, lastName: person.last_name ?? null, linkedAt: now, lastInteractionAt: now, updatedAt: now },
    });
  });
}

async function linkByToken(token: string, person: TelegramPerson, chatId: number): Promise<void> {
  const hash = sha256(token);
  const now = new Date();
  await db.transaction(async (tx) => {
    const [link] = await tx.select().from(customerTelegramLinkTokens).where(and(
      eq(customerTelegramLinkTokens.tokenHash, hash),
      isNull(customerTelegramLinkTokens.consumedAt),
      gt(customerTelegramLinkTokens.expiresAt, now),
    )).for('update').limit(1);
    if (!link) throw new Error('لینک اتصال نامعتبر یا منقضی شده است. از سایت لینک جدید بسازید.');
    const telegramUserId = String(person.id);
    const [occupied] = await tx.select({ userId: customerTelegramAccounts.userId }).from(customerTelegramAccounts)
      .where(eq(customerTelegramAccounts.telegramUserId, telegramUserId)).limit(1);
    if (occupied && occupied.userId !== link.userId) throw new Error('این حساب تلگرام قبلاً به مشتری دیگری متصل شده است.');
    await tx.insert(customerTelegramAccounts).values({
      userId: link.userId,
      telegramUserId,
      chatId: String(chatId),
      username: person.username ?? null,
      firstName: person.first_name ?? null,
      lastName: person.last_name ?? null,
      linkedAt: now,
      lastInteractionAt: now,
    }).onConflictDoUpdate({ target: customerTelegramAccounts.userId, set: { telegramUserId, chatId: String(chatId), username: person.username ?? null, firstName: person.first_name ?? null, lastName: person.last_name ?? null, linkedAt: now, lastInteractionAt: now, updatedAt: now } });
    await tx.update(customerTelegramLinkTokens).set({ consumedAt: now }).where(eq(customerTelegramLinkTokens.id, link.id));
  });
}

async function sendNotificationSettings(chatId: number, account: typeof customerTelegramAccounts.$inferSelect): Promise<void> {
  const prefs = account.notificationPreferences ?? {};
  const labels: Record<CustomerTelegramEvent, string> = { 'order.created': 'ثبت سفارش', 'order.status_changed': 'وضعیت سفارش', 'order.items_changed': 'تغییر اقلام', 'payment.paid': 'پرداخت موفق', 'payment.failed': 'پرداخت ناموفق', 'credit.application_status_changed': 'پرونده اعتبار', 'credit.document_reupload_requested': 'تکمیل مدرک', 'credit.cheque_status_changed': 'وضعیت چک', 'credit.installment_receipt_reminder': 'یادآوری رسید قسط', 'credit.installment_receipt_status_changed': 'بررسی رسید قسط', 'wallet.changed': 'گردش کیف پول', 'payment.instructions_ready': 'اطلاعات پرداخت', 'discount.created': 'کد تخفیف', 'cart.reminder': 'یادآوری سبد خرید', 'order.payment_reminder': 'یادآوری پرداخت', promotion: 'جشنواره‌ها' };
  const rows = CUSTOMER_TELEGRAM_EVENTS.map((event) => [{ text: `${prefs[event] !== false ? '✅' : '☑️'} ${labels[event]}`, data: `ctg:toggle:${event}` }]);
  rows.unshift([{ text: account.notificationsEnabled ? '🔕 توقف همه اعلان‌ها' : '🔔 فعال‌کردن همه اعلان‌ها', data: 'ctg:toggle-all' }]);
  rows.push([{ text: '🔙 بازگشت به منو', data: 'ctg:menu' }]);
  await sendCustomerBotMessage(chatId, `<b>🔔 تنظیم اعلان‌ها</b>\n\nاعلان کلی: ${account.notificationsEnabled ? 'فعال' : 'غیرفعال'}\nروی هر مورد بزنید تا فعال یا غیرفعال شود.`, inlineKeyboard(rows));
}

/** Telegram-only actions: notification preferences and disconnecting. Returns false for anything else. */
async function routeTelegramAction(chatId: number, account: typeof customerTelegramAccounts.$inferSelect, action: string): Promise<boolean> {
  if (action === 'notifications') {
    await sendNotificationSettings(chatId, account);
    return true;
  }
  if (action === 'toggle-all') {
    const [updated] = await db.update(customerTelegramAccounts)
      .set({ notificationsEnabled: !account.notificationsEnabled, updatedAt: new Date() })
      .where(eq(customerTelegramAccounts.id, account.id)).returning();
    if (updated) await sendNotificationSettings(chatId, updated);
    return true;
  }
  if (action.startsWith('toggle:')) {
    const event = action.slice('toggle:'.length) as CustomerTelegramEvent;
    if (!CUSTOMER_TELEGRAM_EVENTS.includes(event)) return true;
    const next = { ...(account.notificationPreferences ?? {}), [event]: account.notificationPreferences?.[event] === false };
    const [updated] = await db.update(customerTelegramAccounts).set({ notificationPreferences: next, updatedAt: new Date() }).where(eq(customerTelegramAccounts.id, account.id)).returning();
    if (updated) await sendNotificationSettings(chatId, updated);
    return true;
  }
  if (action === 'disconnect') {
    await sendCustomerBotMessage(chatId, 'آیا از قطع اتصال حساب تماس مارکت مطمئن هستید؟ پس از آن برای اتصال دوباره باید از سایت لینک بگیرید یا با کد پیامکی وارد شوید.', inlineKeyboard([
      [{ text: 'بله، قطع اتصال', data: 'ctg:disconnect_confirm' }],
      [{ text: 'انصراف', data: `${BOT_CALLBACK_PREFIX}m` }],
    ]));
    return true;
  }
  if (action === 'disconnect_confirm') {
    await db.delete(customerTelegramAccounts).where(eq(customerTelegramAccounts.id, account.id));
    await sendCustomerBotMessage(chatId, 'اتصال حساب شما با ربات قطع شد. برای اتصال دوباره از سایت یا /start استفاده کنید.');
    return true;
  }
  return false;
}

/** Turns a Telegram update into the shared engine's input. */
export function toTelegramBotIncoming(person: { id: number }, chatId: number, message: TelegramMessage | undefined, callbackData: string | undefined): BotIncoming {
  const incoming: BotIncoming = { botUserId: String(person.id), chatId: String(chatId) };
  if (callbackData) return { ...incoming, callbackData };
  if (!message) return incoming;
  if (message.contact) {
    // Telegram vouches for a contact only when it is the sender's own; another
    // number goes through the SMS code like a typed one.
    return telegramContactBelongsToSender(message.contact.user_id, person.id)
      ? { ...incoming, ownContactPhone: normalizePhone(message.contact.phone_number) }
      : { ...incoming, text: message.contact.phone_number };
  }
  const photo = message.photo?.length ? message.photo[message.photo.length - 1] : undefined;
  if (photo) return { ...incoming, file: { fileId: photo.file_id, photo: true, size: photo.file_size } };
  if (message.document) {
    return { ...incoming, file: { fileId: message.document.file_id, photo: false, mimeType: message.document.mime_type, fileName: message.document.file_name, size: message.document.file_size } };
  }
  return { ...incoming, text: message.text ?? message.caption ?? '' };
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

export async function handleCustomerTelegramUpdate(update: CustomerTelegramUpdate): Promise<void> {
  const message = update.message;
  const callback = update.callback_query;
  const person = message?.from ?? callback?.from;
  const chatId = message?.chat.id ?? callback?.message?.chat.id;
  if (!person || !chatId) return;
  try {
    const chatType = message?.chat.type ?? callback?.message?.chat.type;
    if (chatType && chatType !== 'private') throw new Error('برای حفظ حریم خصوصی، ربات مشتریان فقط در گفت‌وگوی خصوصی قابل استفاده است.');
    const config = await getCustomerTelegramConfig();
    if (!config.enabled || !config.botToken) return;

    const linkToken = message?.text?.startsWith('/start') ? parseCustomerTelegramLinkToken(message.text) : null;
    if (linkToken) {
      await linkByToken(linkToken, person, chatId);
      await sendCustomerBotMessage(chatId, `✅ <b>حساب شما با موفقیت متصل شد</b>\n\n${escapeHtml(config.welcomeMessage)}`);
    }

    let account = await linkedAccount(person.id);
    if (account) await touchAccount(account.id);

    let callbackData = callback?.data;
    if (callback) await answerCallback(callback.id).catch(() => undefined);
    if (callbackData?.startsWith('ctg:')) {
      const action = callbackData.slice('ctg:'.length);
      if (LEGACY_ACTIONS[action]) callbackData = `${BOT_CALLBACK_PREFIX}${LEGACY_ACTIONS[action]}`;
      else if (account && await routeTelegramAction(chatId, account, action)) return;
      else callbackData = `${BOT_CALLBACK_PREFIX}m`;
    }
    const command = (message?.text ?? '').split('@')[0]!.split(/\s+/)[0]!.toLowerCase();
    if (account && (command === '/notifications' || command === '/disconnect')) {
      await routeTelegramAction(chatId, account, command.slice(1));
      return;
    }

    const channel: BotChannel = {
      platform: 'telegram',
      transport: telegramTransport(config),
      siteUrl: config.siteUrl,
      supportUrl: config.supportUrl || undefined,
      extraMenuRows: TELEGRAM_MENU_ROWS,
      linkedUserId: async () => account?.userId ?? null,
      link: async (userId) => {
        await linkAccount(userId, person, chatId);
        account = await linkedAccount(person.id);
      },
    };
    await handleCustomerBotInput(channel, toTelegramBotIncoming(person, chatId, message, callbackData), await botDeps());
  } catch (error) {
    await sendCustomerBotMessage(chatId, `❌ ${escapeHtml((error as Error).message || 'عملیات انجام نشد.')}`).catch(() => undefined);
  }
}

export async function createCustomerTelegramLink(userId: number): Promise<{ url: string; expiresAt: string }> {
  const config = await getCustomerTelegramConfig();
  if (!config.enabled || !config.botToken || !config.botUsername) throw new Error('ربات مشتریان هنوز توسط مدیریت فعال و تکمیل نشده است.');
  const token = randomToken(18);
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.delete(customerTelegramLinkTokens).where(eq(customerTelegramLinkTokens.userId, userId));
  await db.insert(customerTelegramLinkTokens).values({ userId, tokenHash: sha256(token), expiresAt });
  return { url: `https://t.me/${config.botUsername}?start=link_${token}`, expiresAt: expiresAt.toISOString() };
}

export async function sendCustomerTelegramNotification(userId: number | null | undefined, event: CustomerTelegramEvent, title: string, text: string): Promise<boolean> {
  if (!userId) return false;
  const config = await getCustomerTelegramConfig();
  if (!config.enabled || !config.botToken || !config.events[event]) return false;
  const [account] = await db.select().from(customerTelegramAccounts).where(eq(customerTelegramAccounts.userId, userId)).limit(1);
  if (!account?.notificationsEnabled || account.notificationPreferences?.[event] === false) return false;
  await sendCustomerBotMessage(account.chatId, `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(text)}`, mainMenu(config));
  return true;
}

export async function broadcastCustomerTelegramNotification(title: string, text: string): Promise<{ sent: number; failed: number }> {
  const config = await getCustomerTelegramConfig();
  if (!config.enabled || !config.botToken || !config.events.promotion) throw new Error('اعلان جشنواره ربات مشتریان فعال نیست.');
  const accounts = await db.select().from(customerTelegramAccounts).where(eq(customerTelegramAccounts.notificationsEnabled, true));
  let sent = 0;
  let failed = 0;
  for (let offset = 0; offset < accounts.length; offset += 20) {
    const batch = accounts.slice(offset, offset + 20).filter((account) => account.notificationPreferences?.promotion !== false);
    const results = await Promise.allSettled(batch.map((account) => sendCustomerBotMessage(
      account.chatId,
      `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(text)}`,
      mainMenu(config),
    )));
    for (const result of results) result.status === 'fulfilled' ? sent++ : failed++;
  }
  return { sent, failed };
}

export async function configureCustomerTelegramWebhook(webhookUrl: string): Promise<{ enabled: boolean; url: string; botUsername: string; pendingUpdates: number }> {
  let config = await getCustomerTelegramConfig();
  if (!config.botToken) throw new Error('توکن ربات مشتریان تنظیم نشده است.');
  if (!/^https:\/\//i.test(webhookUrl)) throw new Error('آدرس webhook باید با https:// شروع شود.');
  if (!config.webhookSecret) {
    await setSetting('private_CUSTOMER_TELEGRAM_WEBHOOK_SECRET', await generateSecret());
    config = await getCustomerTelegramConfig();
  }
  const me = await callTelegramApi(config.botToken, 'getMe', {}, config.proxyUrl);
  const identity = (me.result ?? {}) as { username?: string };
  const username = identity.username ?? config.botUsername;
  if (!username) throw new Error('نام کاربری ربات از تلگرام دریافت نشد.');
  await setSetting('CUSTOMER_TELEGRAM_BOT_USERNAME', username);
  if (!config.enabled) {
    await callTelegramApi(config.botToken, 'deleteWebhook', { drop_pending_updates: false }, config.proxyUrl);
    return { enabled: false, url: '', botUsername: username, pendingUpdates: 0 };
  }
  await callTelegramApi(config.botToken, 'setWebhook', { url: webhookUrl, secret_token: config.webhookSecret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false }, config.proxyUrl);
  await callTelegramApi(config.botToken, 'setMyCommands', { commands: [
    { command: 'start', description: 'منوی اصلی' },
    { command: 'login', description: 'ورود یا ثبت‌نام با کد پیامکی' },
    { command: 'products', description: 'دسته‌بندی محصولات' },
    { command: 'search', description: 'جستجوی کالا' },
    { command: 'cart', description: 'سبد خرید و ثبت سفارش' },
    { command: 'orders', description: 'سفارش‌های من' },
    { command: 'track', description: 'پیگیری سفارش با کد' },
    { command: 'profile', description: 'حساب، جواز کسب و احراز هویت' },
    { command: 'credit', description: 'درخواست و وضعیت اعتبار' },
    { command: 'wallet', description: 'کیف پول من' },
    { command: 'notifications', description: 'تنظیم اعلان‌ها' },
    { command: 'help', description: 'راهنمای استفاده' },
    { command: 'cancel', description: 'لغو مرحله فعلی' },
    { command: 'disconnect', description: 'قطع اتصال حساب' },
  ] }, config.proxyUrl);
  await setSetting('CUSTOMER_TELEGRAM_WEBHOOK_URL', webhookUrl);
  const info = await callTelegramApi(config.botToken, 'getWebhookInfo', {}, config.proxyUrl);
  const status = (info.result ?? {}) as { url?: string; pending_update_count?: number };
  return { enabled: true, url: status.url ?? webhookUrl, botUsername: username, pendingUpdates: Number(status.pending_update_count ?? 0) };
}

export async function testCustomerTelegramBot(): Promise<{ botUsername: string }> {
  const config = await getCustomerTelegramConfig();
  if (!config.botToken) throw new Error('توکن ربات مشتریان تنظیم نشده است.');
  const response = await callTelegramApi(config.botToken, 'getMe', {}, config.proxyUrl);
  const bot = (response.result ?? {}) as { username?: string };
  if (!bot.username) throw new Error('پاسخ ربات معتبر نبود.');
  await setSetting('CUSTOMER_TELEGRAM_BOT_USERNAME', bot.username);
  return { botUsername: bot.username };
}
