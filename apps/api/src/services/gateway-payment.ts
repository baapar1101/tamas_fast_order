import { and, eq, isNull } from 'drizzle-orm';
// @ts-ignore
import paymentGateway from '@tamas/payment';
import { db } from '../db/client.js';
import { orders, payments } from '../db/schema.js';
import { env } from '../env.js';
import { badRequest, notFound } from '../lib/errors.js';

interface PaymentLog {
  error: (obj: unknown, msg?: string) => void;
}

/**
 * Opens a bank-gateway transaction for one of the customer's own unpaid
 * orders and returns the address to pay at. Used by the storefront
 * (`POST /payment/create`) and by the customer bot's «پرداخت آنلاین» button.
 */
export async function createGatewayPayment(userId: number, orderId: number, log?: PaymentLog): Promise<string> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId), isNull(orders.deletedAt)))
    .limit(1);

  if (!order) throw notFound('سفارش پیدا نشد.');
  if (order.paymentStatus === 'paid') throw badRequest('این سفارش قبلاً پرداخت شده است.');
  if (order.status === 'cancelled') throw badRequest('امکان پرداخت سفارش لغوشده وجود ندارد.');

  const amount = order.total;

  const callbackUrl = `${env.PUBLIC_SITE_URL.replace(/\/$/, '')}/api/payment/callback`;

  try {
    const response = await paymentGateway.Create({
      amount,
      callback: callbackUrl,
      invoice_id: String(order.id),
      mobile: order.phone,
      description: `پرداخت سفارش ${order.orderCode}`,
    });

    const data = response.data;
    if (data && data.status === 'success') {
      const transid = data.transid;

      await db.insert(payments).values({
        orderId: order.id,
        userId,
        amount,
        gateway: 'aqayepardakht',
        refId: transid,
        status: 'pending',
      });

      return paymentGateway.StartPay(transid) as string;
    } else {
      throw new Error('خطا در ارتباط با درگاه پرداخت: ' + (data?.code || ''));
    }
  } catch (err: any) {
    log?.error({ err: err.response?.data || err.message }, 'Payment create failed');
    const bankError = err.response?.data?.code || err.response?.data?.message || err.message;
    throw badRequest(`خطا در ایجاد تراکنش بانکی (${bankError}).`);
  }
}
