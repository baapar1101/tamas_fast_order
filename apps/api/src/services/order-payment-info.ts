import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { orders } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { registerOrderCheque } from './credit-cheques.js';
import { claimPrivateFile } from './private-files.js';

export interface OrderPaymentInfoInput {
  orderId: number;
  paymentMethod: string;
  depositorName?: string;
  refNumber?: string;
  receiptNote?: string;
  receiptImageUrl?: string;
  businessName?: string;
  creditNote?: string;
  checkNumber?: string;
  checkBankName?: string;
  checkNote?: string;
}

interface PaymentInfoLog {
  error: (obj: unknown, msg?: string) => void;
}

/**
 * Records the customer's manual payment details on their own order: a
 * card-to-card receipt, or the first cheque of a cheque plan. Shared by the
 * storefront (`POST /orders/payment-info`) and the customer bot.
 */
export async function submitOrderPaymentInfo(
  userId: number,
  body: OrderPaymentInfoInput,
  log?: PaymentInfoLog,
): Promise<{ ok: boolean; message: string }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, body.orderId), eq(orders.userId, userId), isNull(orders.deletedAt)))
    .limit(1);

  if (!order) {
    return { ok: false, message: 'سفارش یافت نشد.' };
  }
  if (body.receiptImageUrl) body.receiptImageUrl = await claimPrivateFile(body.receiptImageUrl, userId, 'payment');

  let registeredCheque: Awaited<ReturnType<typeof registerOrderCheque>>['cheque'] | null = null;
  if (order.paymentPlan?.kind === 'cheque') {
    if (!body.checkNumber?.trim() || !body.checkBankName?.trim()) {
      throw badRequest('شماره صیادی و نام بانک چک اول را وارد کنید.');
    }
    const result = await registerOrderCheque(userId, {
      orderId: order.id,
      chequeNumber: body.checkNumber.trim(),
      bankName: body.checkBankName.trim(),
      accountHolder: order.customerName,
      imageUrl: body.receiptImageUrl || null,
      notes: body.checkNote || null,
    });
    registeredCheque = result.cheque;
  }

  // Build a payment info note
  const { orderId, ...info } = body;
  const existingNote = order.note || '';
  const paymentNote = `\n--- اطلاعات پرداخت (${new Date().toLocaleDateString('fa-IR')}) ---\n${JSON.stringify(info, null, 2)}`;

  await db.update(orders)
    .set({ note: existingNote + paymentNote, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  const { sendTelegramNotification } = await import('./telegram.js');
  void sendTelegramNotification('payment.info_submitted', {
    title: '🧾 اطلاعات پرداخت دستی',
    fields: [
      { label: 'شماره سفارش', value: order.orderCode },
      { label: 'مشتری', value: order.customerName },
      { label: 'روش پرداخت', value: order.paymentPlan?.label ?? body.paymentMethod },
      { label: 'واریزکننده', value: body.depositorName },
      { label: 'شماره پیگیری', value: body.refNumber },
      { label: 'شماره چک', value: body.checkNumber },
      { label: 'مبلغ چک', value: registeredCheque ? `${Number(registeredCheque.amount).toLocaleString('fa-IR')} تومان` : undefined },
      { label: 'سررسید چک', value: registeredCheque?.dueDate },
    ],
  }).catch((err) => log?.error({ err }, 'failed to send Telegram payment info notification'));

  return { ok: true, message: 'اطلاعات پرداخت با موفقیت ثبت شد.' };
}
