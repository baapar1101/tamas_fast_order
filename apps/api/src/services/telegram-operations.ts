import { and, desc, eq, isNull } from 'drizzle-orm';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '@tamas/shared';
import { db } from '../db/client.js';
import { orders, sessions, users } from '../db/schema.js';
import { logAction } from './audit.js';
import { upsertOrderPayment } from './payments.js';
import { sendTemplatedSms } from './sms.js';
import {
  answerTelegramCallback,
  getTelegramConfig,
  sendTelegramMessage,
  type TelegramButton,
} from './telegram.js';
import { refundWalletOrder } from './wallet.js';

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  message_thread_id?: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

type OrderMenuAction = { stage: 'menu'; entity: 'order'; id: number };
type UserAction = { stage: 'ask' | 'do'; entity: 'user'; operation: 'activate' | 'deactivate'; id: number };
type OrderStatusAction = { stage: 'ask' | 'do'; entity: 'order'; operation: 'status'; id: number; value: OrderStatus };
type OrderPaymentAction = { stage: 'ask' | 'do'; entity: 'order'; operation: 'payment'; id: number; value: 'paid' | 'unpaid' | 'pending' };
type OrderAction = OrderStatusAction | OrderPaymentAction;
type TelegramAction = OrderMenuAction | UserAction | OrderAction;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function actorLabel(user: TelegramUser): string {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName || (user.username ? `@${user.username}` : String(user.id));
}

function callback(stage: 'menu' | 'ask' | 'do', entity: 'user' | 'order', operationOrId: string | number, idOrValue?: number | string, value?: string): string {
  return ['tm1', stage, entity, operationOrId, idOrValue, value].filter((part) => part !== undefined).join('|');
}

export function parseTelegramAction(value: string | undefined): TelegramAction | null {
  if (!value || value.length > 64) return null;
  const parts = value.split('|');
  if (parts[0] !== 'tm1') return null;
  if (parts[1] === 'menu' && parts[2] === 'order' && /^\d+$/.test(parts[3] ?? '')) {
    return { stage: 'menu', entity: 'order', id: Number(parts[3]) };
  }
  const stage = parts[1];
  if (stage !== 'ask' && stage !== 'do') return null;
  const entity = parts[2];
  const operation = parts[3];
  const id = Number(parts[4]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (entity === 'user' && (operation === 'activate' || operation === 'deactivate') && parts.length === 5) {
    return { stage, entity, operation, id };
  }
  if (entity === 'order' && operation === 'status' && ORDER_STATUSES.includes(parts[5] as OrderStatus)) {
    return { stage, entity, operation, id, value: parts[5] as OrderStatus };
  }
  if (entity === 'order' && operation === 'payment' && ['paid', 'unpaid', 'pending'].includes(parts[5] ?? '')) {
    return { stage, entity, operation, id, value: parts[5] as 'paid' | 'unpaid' | 'pending' };
  }
  return null;
}

function orderMenu(id: number): TelegramButton[][] {
  return [
    [
      { text: '✅ تأیید', callbackData: callback('ask', 'order', 'status', id, 'confirmed') },
      { text: '🛠 آماده‌سازی', callbackData: callback('ask', 'order', 'status', id, 'preparing') },
    ],
    [
      { text: '🚚 ارسال شد', callbackData: callback('ask', 'order', 'status', id, 'shipped') },
      { text: '📬 تحویل شد', callbackData: callback('ask', 'order', 'status', id, 'delivered') },
    ],
    [
      { text: '💳 پرداخت شد', callbackData: callback('ask', 'order', 'payment', id, 'paid') },
      { text: '⛔ لغو سفارش', callbackData: callback('ask', 'order', 'status', id, 'cancelled') },
    ],
  ];
}

function confirmation(action: Exclude<TelegramAction, { stage: 'menu' }>): { text: string; keyboard: TelegramButton[][] } {
  let label = '';
  if (action.entity === 'user') label = action.operation === 'activate' ? 'تأیید و فعال‌کردن مشتری' : 'غیرفعال‌کردن مشتری';
  else if (action.operation === 'status') label = `تغییر وضعیت سفارش به «${ORDER_STATUS_LABELS[action.value]}»`;
  else label = action.value === 'paid' ? 'ثبت پرداخت سفارش' : `تغییر وضعیت پرداخت به ${action.value}`;
  const data = action.entity === 'user'
    ? callback('do', 'user', action.operation, action.id)
    : callback('do', 'order', action.operation, action.id, action.value);
  return {
    text: `⚠️ آیا از <b>${escapeHtml(label)}</b> مطمئن هستید؟`,
    keyboard: [[{ text: 'بله، انجام شود', callbackData: data }]],
  };
}

async function updateCustomer(action: UserAction, actor: TelegramUser): Promise<string> {
  const [current] = await db.select().from(users).where(and(eq(users.id, action.id), isNull(users.deletedAt))).limit(1);
  if (!current) throw new Error('مشتری پیدا نشد.');
  if (current.role !== 'customer') throw new Error('تغییر وضعیت مدیر یا اپراتور از طریق ربات مجاز نیست.');
  const isActive = action.operation === 'activate';
  if (current.isActive === isActive) return `وضعیت مشتری از قبل «${isActive ? 'فعال' : 'غیرفعال'}» است.`;
  const [updated] = await db.update(users).set({ isActive, updatedAt: new Date() })
    .where(and(eq(users.id, action.id), eq(users.isActive, current.isActive), isNull(users.deletedAt))).returning();
  if (!updated) return 'این مشتری لحظاتی قبل توسط مدیر دیگری تغییر کرده است.';
  if (!isActive) await db.delete(sessions).where(eq(sessions.userId, action.id));
  await logAction(null, `telegram:${action.operation}`, 'user', current.phone, {
    telegramUserId: actor.id,
    telegramActor: actorLabel(actor),
    userId: action.id,
  });
  return `✅ مشتری <b>${escapeHtml([updated!.name, updated!.lastName].filter(Boolean).join(' ') || updated!.phone)}</b> ${isActive ? 'تأیید و فعال' : 'غیرفعال'} شد.`;
}

async function updateOrder(action: OrderAction, actor: TelegramUser): Promise<string> {
  const [current] = await db.select().from(orders).where(and(eq(orders.id, action.id), isNull(orders.deletedAt))).limit(1);
  if (!current) throw new Error('سفارش پیدا نشد.');

  if (action.operation === 'status') {
    if (current.status === action.value) return `وضعیت سفارش از قبل «${ORDER_STATUS_LABELS[action.value]}» است.`;
    const [updated] = action.value === 'cancelled'
      ? await db.transaction(async (tx) => {
          const [row] = await tx.update(orders).set({ status: action.value, updatedAt: new Date() })
            .where(and(eq(orders.id, action.id), eq(orders.status, current.status), isNull(orders.deletedAt))).returning();
          if (row) await refundWalletOrder(tx, row);
          return [row];
        })
      : await db.update(orders).set({ status: action.value, updatedAt: new Date() })
          .where(and(eq(orders.id, action.id), eq(orders.status, current.status), isNull(orders.deletedAt))).returning();
    if (!updated) return 'این سفارش لحظاتی قبل توسط مدیر دیگری تغییر کرده است.';
    if (updated.phone) {
      void sendTemplatedSms(updated.phone, `sms_template_order_${action.value}`, {
        order_code: updated.orderCode,
        name: updated.customerName || 'مشتری',
        status: ORDER_STATUS_LABELS[action.value],
      }).catch(() => undefined);
    }
    await logAction(null, 'telegram:update-status', 'order', updated.orderCode, {
      telegramUserId: actor.id,
      telegramActor: actorLabel(actor),
      previousStatus: current.status,
      status: action.value,
    });
    return `✅ وضعیت سفارش <b>${escapeHtml(updated.orderCode)}</b> به «${ORDER_STATUS_LABELS[action.value]}» تغییر کرد.`;
  }

  if (current.paymentStatus === action.value) return `وضعیت پرداخت سفارش از قبل «${action.value}» است.`;
  const [updated] = await db.update(orders).set({ paymentStatus: action.value, updatedAt: new Date() })
    .where(and(eq(orders.id, action.id), eq(orders.paymentStatus, current.paymentStatus), isNull(orders.deletedAt))).returning();
  if (!updated) return 'پرداخت این سفارش لحظاتی قبل توسط مدیر دیگری تغییر کرده است.';
  await upsertOrderPayment(db, updated.id, updated.userId, updated.total, action.value);
  if (action.value === 'paid' && updated.phone) {
    void sendTemplatedSms(updated.phone, 'sms_template_payment_paid', {
      order_code: updated.orderCode,
      name: updated.customerName || 'مشتری',
    }).catch(() => undefined);
  }
  await logAction(null, 'telegram:update-payment', 'order', updated.orderCode, {
    telegramUserId: actor.id,
    telegramActor: actorLabel(actor),
    previousPaymentStatus: current.paymentStatus,
    paymentStatus: action.value,
  });
  return `✅ پرداخت سفارش <b>${escapeHtml(updated.orderCode)}</b> با وضعیت «${action.value}» ثبت شد.`;
}

async function sendPendingCustomers(chatId: number, threadId?: number): Promise<void> {
  const rows = await db.select().from(users)
    .where(and(eq(users.role, 'customer'), eq(users.isActive, false), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt)).limit(10);
  if (!rows.length) {
    await sendTelegramMessage(chatId, '✅ مشتری در انتظار تأیید وجود ندارد.', undefined, threadId);
    return;
  }
  const lines = rows.map((user, index) => `${index + 1}. <b>${escapeHtml([user.name, user.lastName].filter(Boolean).join(' ') || user.phone)}</b> — <code>${user.phone}</code>`);
  const keyboard = rows.map((user) => [{
    text: `✅ تأیید ${user.phone}`,
    callbackData: callback('ask', 'user', 'activate', user.id),
  }]);
  await sendTelegramMessage(chatId, `👥 <b>مشتریان در انتظار</b>\n\n${lines.join('\n')}`, keyboard, threadId);
}

async function sendRecentOrders(chatId: number, threadId?: number): Promise<void> {
  const rows = await db.select().from(orders).where(isNull(orders.deletedAt)).orderBy(desc(orders.createdAt)).limit(10);
  if (!rows.length) {
    await sendTelegramMessage(chatId, 'سفارشی ثبت نشده است.', undefined, threadId);
    return;
  }
  const lines = rows.map((order, index) => `${index + 1}. <b>${escapeHtml(order.orderCode)}</b> — ${ORDER_STATUS_LABELS[order.status]} — ${order.total.toLocaleString('fa-IR')} تومان`);
  const keyboard = rows.map((order) => [{ text: `⚙️ ${order.orderCode}`, callbackData: callback('menu', 'order', order.id) }]);
  await sendTelegramMessage(chatId, `📦 <b>آخرین سفارش‌ها</b>\n\n${lines.join('\n')}`, keyboard, threadId);
}

async function handleCommand(message: TelegramMessage, authorized: boolean): Promise<void> {
  const command = message.text?.trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase();
  const from = message.from;
  if (!from) return;
  if (command === '/id') {
    await sendTelegramMessage(message.chat.id, `شناسه تلگرام شما: <code>${from.id}</code>`, undefined, message.message_thread_id);
    return;
  }
  if (!authorized) {
    await sendTelegramMessage(message.chat.id, `⛔ دسترسی عملیاتی ندارید.\nشناسه شما: <code>${from.id}</code>`, undefined, message.message_thread_id);
    return;
  }
  if (command === '/pending' || command === '/customers') {
    await sendPendingCustomers(message.chat.id, message.message_thread_id);
    return;
  }
  if (command === '/orders') {
    await sendRecentOrders(message.chat.id, message.message_thread_id);
    return;
  }
  await sendTelegramMessage(message.chat.id,
    '🤖 <b>مدیریت تماس مارکت</b>\n\n/pending — مشتریان در انتظار تأیید\n/orders — آخرین سفارش‌ها\n/id — نمایش شناسه تلگرام',
    [[{ text: '👥 مشتریان در انتظار', callbackData: 'tm1|list|users' }, { text: '📦 سفارش‌ها', callbackData: 'tm1|list|orders' }]],
    message.message_thread_id,
  );
}

async function handleCallback(query: TelegramCallbackQuery, authorized: boolean): Promise<void> {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  await answerTelegramCallback(query.id, authorized ? 'در حال بررسی…' : 'دسترسی ندارید.', !authorized);
  if (!authorized) return;
  if (query.data === 'tm1|list|users') return sendPendingCustomers(chatId, query.message?.message_thread_id);
  if (query.data === 'tm1|list|orders') return sendRecentOrders(chatId, query.message?.message_thread_id);
  const action = parseTelegramAction(query.data);
  if (!action) throw new Error('عملیات شناخته نشد یا منقضی شده است.');
  if (action.stage === 'menu') {
    await sendTelegramMessage(chatId, `وضعیت جدید سفارش را انتخاب کنید:`, orderMenu(action.id), query.message?.message_thread_id);
    return;
  }
  if (action.stage === 'ask') {
    const prompt = confirmation(action);
    await sendTelegramMessage(chatId, prompt.text, prompt.keyboard, query.message?.message_thread_id);
    return;
  }
  const result = action.entity === 'user' ? await updateCustomer(action, query.from) : await updateOrder(action, query.from);
  await sendTelegramMessage(chatId, result, undefined, query.message?.message_thread_id);
}

/** Telegram must receive HTTP 200 quickly; failures are reported in chat and never retried forever. */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.operationsEnabled) return;
  const from = update.callback_query?.from ?? update.message?.from;
  if (!from) return;
  const authorized = config.allowedUserIds.includes(String(from.id));
  try {
    if (update.callback_query) await handleCallback(update.callback_query, authorized);
    else if (update.message?.text?.startsWith('/')) await handleCommand(update.message, authorized);
  } catch (error) {
    const chatId = update.callback_query?.message?.chat.id ?? update.message?.chat.id;
    const threadId = update.callback_query?.message?.message_thread_id ?? update.message?.message_thread_id;
    if (chatId) await sendTelegramMessage(chatId, `❌ ${escapeHtml((error as Error).message || 'عملیات انجام نشد.')}`, undefined, threadId).catch(() => undefined);
  }
}

export const telegramActionButtons = {
  customer(userId: number): TelegramButton[][] {
    return [[
      { text: '✅ تأیید مشتری', callbackData: callback('ask', 'user', 'activate', userId) },
      { text: '🚫 غیرفعال', callbackData: callback('ask', 'user', 'deactivate', userId) },
    ]];
  },
  order(orderId: number): TelegramButton[][] {
    return [[
      { text: '✅ تأیید سفارش', callbackData: callback('ask', 'order', 'status', orderId, 'confirmed') },
      { text: '⚙️ تغییر وضعیت', callbackData: callback('menu', 'order', orderId) },
    ], [
      { text: '💳 پرداخت شد', callbackData: callback('ask', 'order', 'payment', orderId, 'paid') },
    ]];
  },
};
