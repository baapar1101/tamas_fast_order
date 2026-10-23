import { and, asc, eq, isNull } from 'drizzle-orm';
import {
  chequeDueDate,
  firstChequeSubmissionDeadline,
  formatPersianDueDate,
  type CreditChequeWrite,
  type PaymentPlanQuote,
} from '@tamas/shared';
import { db, schema } from '../db/client.js';
import { badRequest, notFound } from '../lib/errors.js';
import { claimPrivateFile } from './private-files.js';

type RegisterChequeInput = Pick<CreditChequeWrite, 'chequeNumber' | 'bankName' | 'accountHolder' | 'imageUrl' | 'notes'> & {
  orderId: number;
};

function scheduledInstallment(plan: PaymentPlanQuote, orderDate: Date, index: number) {
  const item = plan.schedule[index];
  const amount = item?.amount;
  if (!item || amount == null || amount <= 0) return null;
  const dueDate = item.dueDate ?? chequeDueDate(orderDate, index, plan.installmentIntervalMonths ?? 1, plan.termMonths);
  return { ...item, amount, dueDate, dueLabel: formatPersianDueDate(dueDate) };
}

/** Register only the next server-calculated cheque for a customer's order. */
export async function registerOrderCheque(userId: number, input: RegisterChequeInput) {
  const imageUrl = input.imageUrl ? await claimPrivateFile(input.imageUrl, userId, 'credit') : null;
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.id, input.orderId), eq(schema.orders.userId, userId), isNull(schema.orders.deletedAt)))
      .for('update')
      .limit(1);

    if (!order) throw notFound('سفارش انتخاب‌شده پیدا نشد.');
    if (order.paymentPlan?.kind !== 'cheque') throw badRequest('این سفارش برنامه پرداخت چکی ندارد.');

    const existing = await tx
      .select({ id: schema.creditCheques.id, chequeNumber: schema.creditCheques.chequeNumber })
      .from(schema.creditCheques)
      .where(eq(schema.creditCheques.orderId, order.id))
      .orderBy(asc(schema.creditCheques.createdAt));

    if (existing.some((item) => item.chequeNumber === input.chequeNumber)) {
      throw badRequest('این شماره چک قبلاً برای سفارش ثبت شده است.');
    }

    const next = scheduledInstallment(order.paymentPlan, order.createdAt, existing.length);
    if (!next) throw badRequest('همه چک‌های این سفارش قبلاً ثبت شده‌اند.');

    if (existing.length === 0) {
      const deadline = firstChequeSubmissionDeadline(order.createdAt);
      if (Date.now() > deadline.getTime()) {
        throw badRequest(`مهلت ثبت چک اول این سفارش در ${deadline.toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })} پایان یافته است.`);
      }
    }

    const [application] = await tx
      .select({ id: schema.creditApplications.id })
      .from(schema.creditApplications)
      .where(eq(schema.creditApplications.userId, userId))
      .orderBy(asc(schema.creditApplications.createdAt))
      .limit(1);

    const [inserted] = await tx
      .insert(schema.creditCheques)
      .values({
        userId,
        ...(application ? { creditApplicationId: application.id } : {}),
        orderId: order.id,
        chequeNumber: input.chequeNumber,
        bankName: input.bankName,
        accountHolder: input.accountHolder,
        amount: next.amount,
        dueDate: next.dueDate,
        imageUrl,
        notes: input.notes || null,
        status: 'pending',
      })
      .returning();

    if (!inserted) throw badRequest('خطا در ثبت چک.');
    return { cheque: inserted, order, installment: next };
  });
}
