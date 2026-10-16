import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { normalizePhone } from '@tamas/shared';
import { db } from '../db/client.js';
import {
  creditApplications,
  creditCheques,
  customerTelegramAccounts,
  customerTelegramLinkTokens,
  orders,
  users,
  walletAccounts,
} from '../db/schema.js';
import { randomToken, sha256 } from '../lib/hash.js';
import { callTelegramApi } from './telegram.js';
import { generateSecret, getAllSettings, setSetting } from './settings.js';
import { normalizeTelegramBotUsername, parseCustomerTelegramLinkToken, telegramContactBelongsToSender } from './customer-telegram-model.js';

export const CUSTOMER_TELEGRAM_EVENTS = [
  'order.created',
  'order.status_changed',
  'order.items_changed',
  'payment.paid',
  'payment.failed',
  'credit.application_status_changed',
  'credit.cheque_status_changed',
  'wallet.changed',
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
  contact?: { phone_number: string; user_id?: number; first_name?: string; last_name?: string };
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
const STATUS_LABELS: Record<string, string> = {
  new: 'جدید', confirmed: 'تأییدشده', preparing: 'در حال آماده‌سازی', shipped: 'ارسال‌شده', delivered: 'تحویل‌شده', cancelled: 'لغوشده',
  pending: 'در انتظار', reviewing: 'در حال بررسی', active: 'فعال', action_required: 'نیازمند اقدام', passed: 'وصول‌شده', bounced: 'برگشتی', returned: 'عودت‌شده',
};

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

function money(value: number): string {
  return `${Math.round(value).toLocaleString('fa-IR')} تومان`;
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

async function answerCallback(id: string, text: string): Promise<void> {
  const config = await getCustomerTelegramConfig();
  if (!config.botToken) return;
  await callTelegramApi(config.botToken, 'answerCallbackQuery', { callback_query_id: id, text: text.slice(0, 180) }, config.proxyUrl);
}

function mainMenu(config: CustomerTelegramConfig): Record<string, unknown> {
  const rows = [
    [{ text: '📦 سفارش‌های من', data: 'ctg:orders' }, { text: '💳 کیف پول', data: 'ctg:wallet' }],
    [{ text: '🧾 پرونده اعتباری', data: 'ctg:credit' }, { text: '👤 حساب من', data: 'ctg:profile' }],
    [{ text: '🔔 تنظیم اعلان‌ها', data: 'ctg:notifications' }],
    [{ text: '❓ راهنما', data: 'ctg:help' }, { text: '🔌 قطع اتصال', data: 'ctg:disconnect' }],
    [{ text: '🛍 ورود به فروشگاه', url: config.siteUrl }],
  ];
  if (config.supportUrl) rows.push([{ text: '💬 پشتیبانی', url: config.supportUrl }]);
  return inlineKeyboard(rows);
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

async function sendWelcome(chatId: number): Promise<void> {
  const config = await getCustomerTelegramConfig();
  await sendCustomerBotMessage(chatId, `✅ <b>حساب شما با موفقیت متصل شد</b>\n\n${escapeHtml(config.welcomeMessage)}`, mainMenu(config));
}

async function requestContact(chatId: number): Promise<void> {
  await sendCustomerBotMessage(chatId, 'برای اتصال حساب، شماره‌ای را که با آن در تماس مارکت ثبت‌نام کرده‌اید از دکمه زیر به‌اشتراک بگذارید.', {
    keyboard: [[{ text: '📱 اشتراک‌گذاری شماره من', request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  });
}

async function sendOrders(chatId: number, userId: number): Promise<void> {
  const rows = await db.select({ id: orders.id, code: orders.orderCode, total: orders.total, status: orders.status, createdAt: orders.createdAt })
    .from(orders).where(and(eq(orders.userId, userId), isNull(orders.deletedAt))).orderBy(desc(orders.createdAt)).limit(8);
  if (!rows.length) return sendCustomerBotMessage(chatId, '📦 هنوز سفارشی برای حساب شما ثبت نشده است.');
  const lines = rows.map((order) => `• <code>${escapeHtml(order.code)}</code> — ${escapeHtml(STATUS_LABELS[order.status] ?? order.status)}\n  ${money(order.total)} · ${order.createdAt.toLocaleDateString('fa-IR')}`);
  await sendCustomerBotMessage(chatId, `<b>📦 آخرین سفارش‌های شما</b>\n\n${lines.join('\n\n')}`);
}

async function sendWallet(chatId: number, userId: number): Promise<void> {
  const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
  await sendCustomerBotMessage(chatId, wallet
    ? `<b>💳 کیف پول شما</b>\n\nموجودی: <b>${money(wallet.balance)}</b>\nمجموع واریز: ${money(wallet.lifetimeCredit)}\nمجموع برداشت: ${money(wallet.lifetimeDebit)}${wallet.isFrozen ? '\n\n⚠️ کیف پول مسدود است.' : ''}`
    : '💳 هنوز کیف پولی برای حساب شما ایجاد نشده است.');
}

async function sendCredit(chatId: number, userId: number): Promise<void> {
  const [application] = await db.select().from(creditApplications).where(eq(creditApplications.userId, userId)).orderBy(desc(creditApplications.createdAt)).limit(1);
  if (!application) return sendCustomerBotMessage(chatId, '🧾 پرونده اعتباری فعالی ندارید.');
  const cheques = await db.select().from(creditCheques).where(eq(creditCheques.userId, userId)).orderBy(desc(creditCheques.createdAt)).limit(10);
  const pending = cheques.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0);
  const bounced = cheques.filter((item) => item.status === 'bounced').length;
  await sendCustomerBotMessage(chatId, `<b>🧾 پرونده اعتباری</b>\n\nوضعیت: <b>${escapeHtml(STATUS_LABELS[application.status] ?? application.status)}</b>\nسقف اعتبار: ${money(application.assignedCreditLimit)}\nچک در انتظار: ${money(pending)}${bounced ? `\n⚠️ چک برگشتی: ${bounced.toLocaleString('fa-IR')} فقره` : ''}`);
}

async function sendProfile(chatId: number, userId: number): Promise<void> {
  const [user] = await db.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  if (!user) throw new Error('حساب کاربری پیدا نشد.');
  await sendCustomerBotMessage(chatId, `<b>👤 حساب تماس مارکت</b>\n\nنام: ${escapeHtml([user.name, user.lastName].filter(Boolean).join(' ') || 'ثبت نشده')}\nفروشگاه: ${escapeHtml(user.storeName || 'ثبت نشده')}\nموبایل: <code>${escapeHtml(user.phone)}</code>\nوضعیت حساب: ${user.isActive ? 'فعال ✅' : 'در انتظار تأیید ⏳'}`);
}

async function sendNotificationSettings(chatId: number, account: typeof customerTelegramAccounts.$inferSelect): Promise<void> {
  const prefs = account.notificationPreferences ?? {};
  const labels: Record<CustomerTelegramEvent, string> = { 'order.created': 'ثبت سفارش', 'order.status_changed': 'وضعیت سفارش', 'order.items_changed': 'تغییر اقلام', 'payment.paid': 'پرداخت موفق', 'payment.failed': 'پرداخت ناموفق', 'credit.application_status_changed': 'پرونده اعتبار', 'credit.cheque_status_changed': 'وضعیت چک', 'wallet.changed': 'گردش کیف پول', promotion: 'جشنواره‌ها' };
  const rows = CUSTOMER_TELEGRAM_EVENTS.map((event) => [{ text: `${prefs[event] !== false ? '✅' : '☑️'} ${labels[event]}`, data: `ctg:toggle:${event}` }]);
  rows.unshift([{ text: account.notificationsEnabled ? '🔕 توقف همه اعلان‌ها' : '🔔 فعال‌کردن همه اعلان‌ها', data: 'ctg:toggle-all' }]);
  rows.push([{ text: '🔙 بازگشت به منو', data: 'ctg:menu' }]);
  await sendCustomerBotMessage(chatId, `<b>🔔 تنظیم اعلان‌ها</b>\n\nاعلان کلی: ${account.notificationsEnabled ? 'فعال' : 'غیرفعال'}\nروی هر مورد بزنید تا فعال یا غیرفعال شود.`, inlineKeyboard(rows));
}

async function routeLinkedAction(chatId: number, account: typeof customerTelegramAccounts.$inferSelect, action: string): Promise<void> {
  if (action === 'orders') return sendOrders(chatId, account.userId);
  if (action === 'wallet') return sendWallet(chatId, account.userId);
  if (action === 'credit') return sendCredit(chatId, account.userId);
  if (action === 'profile') return sendProfile(chatId, account.userId);
  if (action === 'notifications') return sendNotificationSettings(chatId, account);
  if (action === 'toggle-all') {
    const [updated] = await db.update(customerTelegramAccounts)
      .set({ notificationsEnabled: !account.notificationsEnabled, updatedAt: new Date() })
      .where(eq(customerTelegramAccounts.id, account.id)).returning();
    if (updated) await sendNotificationSettings(chatId, updated);
    return;
  }
  if (action === 'help') {
    await sendCustomerBotMessage(chatId, '<b>راهنمای ربات مشتریان تماس مارکت</b>\n\nاز منوی زیر می‌توانید سفارش‌ها، کیف پول، پرونده اعتباری و تنظیم اعلان‌ها را ببینید. برای امنیت، اطلاعات فقط برای حساب متصل‌شده نمایش داده می‌شود. برای قطع ارتباط دستور /disconnect را بفرستید.', mainMenu(await getCustomerTelegramConfig()));
    return;
  }
  if (action === 'disconnect') {
    await sendCustomerBotMessage(chatId, 'آیا از قطع اتصال حساب تماس مارکت مطمئن هستید؟ پس از آن برای اتصال دوباره باید از سایت لینک جدید بگیرید.', inlineKeyboard([
      [{ text: 'بله، قطع اتصال', data: 'ctg:disconnect_confirm' }],
      [{ text: 'انصراف', data: 'ctg:menu' }],
    ]));
    return;
  }
  if (action === 'disconnect_confirm') {
    await db.delete(customerTelegramAccounts).where(eq(customerTelegramAccounts.id, account.id));
    await sendCustomerBotMessage(chatId, 'اتصال حساب شما با ربات قطع شد. برای اتصال دوباره از سایت یا /start استفاده کنید.');
    return;
  }
  const config = await getCustomerTelegramConfig();
  await sendCustomerBotMessage(chatId, `<b>منوی مشتریان تماس مارکت</b>\n\nیکی از گزینه‌ها را انتخاب کنید.`, mainMenu(config));
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
    if (message?.text?.startsWith('/start')) {
      const linkToken = parseCustomerTelegramLinkToken(message.text);
      if (linkToken) {
        await linkByToken(linkToken, person, chatId);
        return sendWelcome(chatId);
      }
      const account = await linkedAccount(person.id);
      if (account) { await touchAccount(account.id); return routeLinkedAction(chatId, account, 'menu'); }
      return requestContact(chatId);
    }

    if (message?.contact) {
      if (!telegramContactBelongsToSender(message.contact.user_id, person.id)) throw new Error('فقط شماره متعلق به حساب تلگرام خودتان قابل پذیرش است.');
      const phone = normalizePhone(message.contact.phone_number);
      const [user] = await db.select().from(users).where(and(eq(users.phone, phone), isNull(users.deletedAt))).limit(1);
      if (!user) throw new Error('حسابی با این شماره در تماس مارکت پیدا نشد. ابتدا در سایت ثبت‌نام کنید.');
      await linkAccount(user.id, person, chatId);
      return sendWelcome(chatId);
    }

    const account = await linkedAccount(person.id);
    if (!account) return requestContact(chatId);
    await touchAccount(account.id);

    if (callback) {
      await answerCallback(callback.id, 'انجام شد');
      const data = callback.data ?? '';
      if (data.startsWith('ctg:toggle:')) {
        const event = data.slice('ctg:toggle:'.length) as CustomerTelegramEvent;
        if (!CUSTOMER_TELEGRAM_EVENTS.includes(event)) return;
        const next = { ...(account.notificationPreferences ?? {}), [event]: account.notificationPreferences?.[event] === false };
        const [updated] = await db.update(customerTelegramAccounts).set({ notificationPreferences: next, updatedAt: new Date() }).where(eq(customerTelegramAccounts.id, account.id)).returning();
        if (updated) await sendNotificationSettings(chatId, updated);
        return;
      }
      return routeLinkedAction(chatId, account, data.replace(/^ctg:/, ''));
    }

    const command = (message?.text ?? '').split('@')[0]!.split(/\s+/)[0]!.toLowerCase();
    const action = command === '/orders' ? 'orders' : command === '/wallet' ? 'wallet' : command === '/credit' ? 'credit' : command === '/profile' ? 'profile' : command === '/notifications' ? 'notifications' : command === '/disconnect' ? 'disconnect' : command === '/help' ? 'help' : 'menu';
    await routeLinkedAction(chatId, account, action);
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

export async function sendCustomerTelegramNotification(userId: number | null | undefined, event: CustomerTelegramEvent, title: string, text: string): Promise<void> {
  if (!userId) return;
  const config = await getCustomerTelegramConfig();
  if (!config.enabled || !config.botToken || !config.events[event]) return;
  const [account] = await db.select().from(customerTelegramAccounts).where(eq(customerTelegramAccounts.userId, userId)).limit(1);
  if (!account?.notificationsEnabled || account.notificationPreferences?.[event] === false) return;
  await sendCustomerBotMessage(account.chatId, `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(text)}`, mainMenu(config));
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
    { command: 'start', description: 'اتصال حساب و منوی اصلی' },
    { command: 'orders', description: 'سفارش‌های من' },
    { command: 'wallet', description: 'کیف پول من' },
    { command: 'credit', description: 'پرونده اعتباری من' },
    { command: 'profile', description: 'حساب کاربری من' },
    { command: 'notifications', description: 'تنظیم اعلان‌ها' },
    { command: 'help', description: 'راهنمای استفاده' },
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
