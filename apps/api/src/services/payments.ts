import { eq } from 'drizzle-orm';
import { db, type Db } from '../db/client.js';
import { payments } from '../db/schema.js';

type DbClient = Db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type OrderPaymentStatus = 'paid' | 'unpaid' | 'pending';

/** Order-level payment status → the transaction status stored in `payments`. */
export function paymentTxStatus(orderPaymentStatus: OrderPaymentStatus): 'pending' | 'success' {
  return orderPaymentStatus === 'paid' ? 'success' : 'pending';
}

/**
 * Keep the payment row for an order in sync with the order's payment status.
 * Creates the row on first contact; afterwards only updates the status.
 */
export async function upsertOrderPayment(
  tx: DbClient,
  orderId: number,
  userId: number | null,
  amount: number,
  paymentStatus: OrderPaymentStatus,
): Promise<void> {
  const [existing] = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);

  const status = paymentTxStatus(paymentStatus);

  if (existing) {
    await tx.update(payments).set({ status, updatedAt: new Date() }).where(eq(payments.id, existing.id));
  } else {
    await tx.insert(payments).values({ orderId, userId, amount, status });
  }
}