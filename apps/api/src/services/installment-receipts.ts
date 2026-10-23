import type {
  InstallmentOrderDTO,
  InstallmentReceiptDTO,
  PaymentHealthClassification,
  PaymentHealthDashboardDTO,
  PaymentPlanQuote,
} from '@tamas/shared';
import { chequeDueDate, formatPersianDueDate } from '@tamas/shared';
import { and, asc, desc, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { db, schema } from '../db/client.js';
import { sendCustomerNotification } from './customer-messaging.js';
import { sendTemplatedSms } from './sms.js';

const TEHRAN_TIME_ZONE = 'Asia/Tehran';
const REMINDER_SLOT_HOURS = [9, 14, 19] as const;

type InstallmentOrderRow = {
  id: number;
  orderCode: string;
  userId: number | null;
  customerName: string;
  phone: string;
  storeName: string | null;
  createdAt: Date;
  paymentStatus: 'paid' | 'unpaid' | 'pending';
  paymentPlan: PaymentPlanQuote | null;
};

function tehranParts(value = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) };
}

function localDate(value: Date): string {
  return tehranParts(value).date;
}

function latinDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export function resolveInstallmentDueDate(orderDate: Date, plan: PaymentPlanQuote, index: number): string | null {
  const item = plan.schedule[index];
  if (!item || item.amount == null || item.amount <= 0) return null;
  if (item.dueDate) return item.dueDate;
  if (plan.kind === 'cheque') {
    return chequeDueDate(orderDate, index, plan.installmentIntervalMonths ?? 1, plan.termMonths);
  }
  if (plan.kind === 'daily') {
    const parsedText = latinDigits(item.dueLabel).match(/\d+/)?.[0];
    const parsedDay = parsedText == null ? Number.NaN : Number(parsedText);
    const fallbackDay = plan.settlementDays && plan.schedule.length > 0
      ? Math.round(plan.settlementDays * (index + 1) / plan.schedule.length)
      : index + 1;
    return localDate(new Date(orderDate.getTime() + (Number.isFinite(parsedDay) ? parsedDay : fallbackDay) * 86_400_000));
  }
  return null;
}

function reminderSlot(hour: number): number | null {
  if (hour < REMINDER_SLOT_HOURS[0]) return null;
  if (hour < REMINDER_SLOT_HOURS[1]) return 1;
  if (hour < REMINDER_SLOT_HOURS[2]) return 2;
  return 3;
}

function isInstallmentPlan(plan: PaymentPlanQuote | null): plan is PaymentPlanQuote & { kind: 'cheque' | 'daily' } {
  return Boolean(plan && (plan.kind === 'cheque' || plan.kind === 'daily') && plan.schedule.some((item) => Number(item.amount) > 0));
}

export function toInstallmentReceiptDTO(row: typeof schema.installmentReceipts.$inferSelect): InstallmentReceiptDTO {
  return {
    id: row.id,
    orderId: row.orderId,
    userId: row.userId,
    installmentIndex: row.installmentIndex,
    amount: Number(row.amount),
    dueDate: row.dueDate,
    receiptUrl: row.receiptUrl,
    trackingCode: row.trackingCode,
    note: row.note,
    status: row.status,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function buildInstallmentOrderDTO(
  order: Pick<InstallmentOrderRow, 'id' | 'orderCode' | 'createdAt' | 'paymentPlan'>,
  receipts: Array<typeof schema.installmentReceipts.$inferSelect>,
  today = tehranParts().date,
): InstallmentOrderDTO | null {
  const plan = order.paymentPlan;
  if (!isInstallmentPlan(plan)) return null;
  const receiptByIndex = new Map(receipts.filter((item) => item.orderId === order.id).map((item) => [item.installmentIndex, item]));
  const schedule = plan.schedule.flatMap((item, index) => {
    const dueDate = resolveInstallmentDueDate(order.createdAt, plan, index);
    if (!dueDate || item.amount == null || item.amount <= 0) return [];
    const receipt = receiptByIndex.get(index);
    return [{
      index,
      amount: item.amount,
      dueDate,
      dueLabel: item.dueDate ? item.dueLabel : formatPersianDueDate(dueDate),
      isDue: dueDate <= today,
      isOverdue: dueDate < today && (!receipt || receipt.status === 'rejected'),
      receipt: receipt ? toInstallmentReceiptDTO(receipt) : null,
    }];
  });
  if (schedule.length === 0) return null;
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    planLabel: plan.label,
    planKind: plan.kind,
    createdAt: order.createdAt.toISOString(),
    schedule,
  };
}

async function installmentOrders(): Promise<InstallmentOrderRow[]> {
  return db.select({
    id: schema.orders.id,
    orderCode: schema.orders.orderCode,
    userId: schema.orders.userId,
    customerName: schema.orders.customerName,
    phone: schema.orders.phone,
    storeName: schema.orders.storeName,
    createdAt: schema.orders.createdAt,
    paymentStatus: schema.orders.paymentStatus,
    paymentPlan: schema.orders.paymentPlan,
  }).from(schema.orders).where(and(
    isNull(schema.orders.deletedAt),
    ne(schema.orders.status, 'cancelled'),
    isNotNull(schema.orders.userId),
    isNotNull(schema.orders.paymentPlan),
  )).orderBy(desc(schema.orders.createdAt));
}

export async function sendDueInstallmentReceiptReminders(log?: FastifyBaseLogger): Promise<number> {
  const now = tehranParts();
  const slot = reminderSlot(now.hour);
  if (!slot) return 0;

  const [orders, receipts] = await Promise.all([
    installmentOrders(),
    db.select().from(schema.installmentReceipts),
  ]);
  const receiptsByKey = new Map(receipts.map((item) => [`${item.orderId}:${item.installmentIndex}`, item]));
  const pendingByUser = new Map<number, Array<{ order: InstallmentOrderRow; index: number; amount: number; dueDate: string }>>();

  for (const order of orders) {
    if (!order.userId || order.paymentStatus === 'paid' || !isInstallmentPlan(order.paymentPlan)) continue;
    order.paymentPlan.schedule.forEach((item, index) => {
      const dueDate = resolveInstallmentDueDate(order.createdAt, order.paymentPlan!, index);
      if (!dueDate || !item.amount || item.amount <= 0 || dueDate > now.date) return;
      const receipt = receiptsByKey.get(`${order.id}:${index}`);
      if (receipt && receipt.status !== 'rejected') return;
      const list = pendingByUser.get(order.userId!) ?? [];
      list.push({ order, index, amount: item.amount, dueDate });
      pendingByUser.set(order.userId!, list);
    });
  }

  let sent = 0;
  for (const [userId, missing] of pendingByUser) {
    const first = missing[0];
    if (!first) continue;
    const [delivery] = await db.insert(schema.installmentReminderDeliveries).values({
      orderId: first.order.id,
      userId,
      installmentIndex: first.index,
      reminderDate: now.date,
      reminderSlot: slot,
    }).onConflictDoNothing().returning({ id: schema.installmentReminderDeliveries.id });
    if (!delivery) continue;

    const total = missing.reduce((sum, item) => sum + item.amount, 0);
    const orderCodes = [...new Set(missing.map((item) => item.order.orderCode))].slice(0, 3).join('، ');
    const title = '⏰ رسید پرداخت قسط بارگذاری نشده است';
    const text = `${missing.length.toLocaleString('fa-IR')} رسید قسط سررسیدشده برای سفارش ${orderCodes} ثبت نشده است. مجموع مبلغ: ${Math.round(total).toLocaleString('fa-IR')} تومان. لطفاً همین حالا از پنل اعتباری رسید را بارگذاری کنید.`;
    const channels = await sendCustomerNotification(userId, 'credit.installment_receipt_reminder', title, text);
    const smsResult = await sendTemplatedSms(
      first.order.phone,
      'sms_template_installment_receipt_reminder',
      { name: first.order.customerName, count: String(missing.length), amount: Math.round(total).toLocaleString('fa-IR'), order: orderCodes },
      `کاربر گرامی، رسید ${missing.length.toLocaleString('fa-IR')} قسط سررسیدشده سفارش ${orderCodes} ثبت نشده است. لطفاً رسید پرداخت را در پنل اعتباری بارگذاری کنید.`,
    ).catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    await db.update(schema.installmentReminderDeliveries).set({
      deliveredChannels: { telegram: channels.telegram, bale: channels.bale, sms: smsResult.ok && !smsResult.error },
    }).where(eq(schema.installmentReminderDeliveries.id, delivery.id));
    sent += 1;
  }
  if (sent > 0) log?.info({ customers: sent, slot, date: now.date }, 'installment receipt reminders sent');
  return sent;
}

export async function getPaymentHealthDashboard(): Promise<PaymentHealthDashboardDTO> {
  const [orders, receipts, cheques] = await Promise.all([
    installmentOrders(),
    db.select().from(schema.installmentReceipts).orderBy(desc(schema.installmentReceipts.submittedAt)),
    db.select().from(schema.creditCheques).orderBy(asc(schema.creditCheques.createdAt)),
  ]);
  const today = tehranParts().date;
  const receiptsByKey = new Map(receipts.map((item) => [`${item.orderId}:${item.installmentIndex}`, item]));
  const chequesByOrder = new Map<number, typeof cheques>();
  cheques.forEach((cheque) => {
    if (!cheque.orderId) return;
    const list = chequesByOrder.get(cheque.orderId) ?? [];
    list.push(cheque);
    chequesByOrder.set(cheque.orderId, list);
  });
  const customers = new Map<number, PaymentHealthDashboardDTO['customers'][number]>();

  for (const order of orders) {
    if (!order.userId || !isInstallmentPlan(order.paymentPlan)) continue;
    const row = customers.get(order.userId) ?? {
      userId: order.userId,
      userName: order.customerName,
      userPhone: order.phone,
      userStoreName: order.storeName ?? '',
      totalInstallments: 0,
      approvedOnTime: 0,
      approvedLate: 0,
      overdueWithoutReceipt: 0,
      pendingReceipts: 0,
      rejectedReceipts: 0,
      bouncedCheques: 0,
      score: 100,
      classification: 'good' as const,
      lastDueDate: null,
    };
    const orderCheques = chequesByOrder.get(order.id) ?? [];
    order.paymentPlan.schedule.forEach((item, index) => {
      const dueDate = resolveInstallmentDueDate(order.createdAt, order.paymentPlan!, index);
      if (!dueDate || !item.amount || item.amount <= 0) return;
      row.totalInstallments += 1;
      if (!row.lastDueDate || dueDate > row.lastDueDate) row.lastDueDate = dueDate;
      const receipt = receiptsByKey.get(`${order.id}:${index}`);
      const cheque = orderCheques[index];
      if (receipt?.status === 'approved') {
        if (localDate(receipt.submittedAt) <= dueDate) row.approvedOnTime += 1;
        else row.approvedLate += 1;
      } else if (receipt?.status === 'pending') {
        row.pendingReceipts += 1;
      } else if (receipt?.status === 'rejected') {
        row.rejectedReceipts += 1;
        if (dueDate < today) row.overdueWithoutReceipt += 1;
      } else if (cheque?.status === 'passed') {
        row.approvedOnTime += 1;
      } else if (dueDate < today && order.paymentStatus !== 'paid') {
        row.overdueWithoutReceipt += 1;
      }
      if (cheque?.status === 'bounced') row.bouncedCheques += 1;
    });
    customers.set(order.userId, row);
  }

  const customerRows = [...customers.values()].map((row) => {
    const completedInstallments = row.approvedOnTime + row.approvedLate;
    const score = Math.max(0, (completedInstallments > 0 ? 100 : 80)
      - row.overdueWithoutReceipt * 25
      - row.bouncedCheques * 35
      - row.rejectedReceipts * 15
      - row.approvedLate * 8
      - row.pendingReceipts * 2);
    const classification: PaymentHealthClassification = row.bouncedCheques > 0 || row.overdueWithoutReceipt > 0 || row.rejectedReceipts > 0
      ? 'bad'
      : row.pendingReceipts > 0 || row.approvedLate > 0 || completedInstallments === 0 ? 'attention' : 'good';
    return { ...row, score, classification };
  }).sort((a, b) => a.score - b.score || b.overdueWithoutReceipt - a.overdueWithoutReceipt);

  const orderById = new Map(orders.map((order) => [order.id, order]));
  const receiptRows = receipts.map((receipt) => {
    const order = orderById.get(receipt.orderId);
    return {
      ...toInstallmentReceiptDTO(receipt),
      orderCode: order?.orderCode ?? String(receipt.orderId),
      userName: order?.customerName ?? 'کاربر',
      userPhone: order?.phone ?? '',
      userStoreName: order?.storeName ?? '',
    };
  });

  return {
    summary: {
      totalCustomers: customerRows.length,
      good: customerRows.filter((item) => item.classification === 'good').length,
      attention: customerRows.filter((item) => item.classification === 'attention').length,
      bad: customerRows.filter((item) => item.classification === 'bad').length,
      pendingReceipts: customerRows.reduce((sum, item) => sum + item.pendingReceipts, 0),
      overdueWithoutReceipt: customerRows.reduce((sum, item) => sum + item.overdueWithoutReceipt, 0),
    },
    customers: customerRows,
    receipts: receiptRows,
  };
}
