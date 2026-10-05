/** One-off: create a payment row for orders that predate the payment ledger. Idempotent. */
import { eq, isNull } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { orders, payments } from '../src/db/schema.js';
import { paymentTxStatus } from '../src/services/payments.js';

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      amount: orders.total,
      paymentStatus: orders.paymentStatus,
      orderCode: orders.orderCode,
      paymentId: payments.id,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(isNull(payments.id));

  if (rows.length === 0) {
    console.log('✅ همه سفارش‌ها از قبل ردیف پرداخت دارند — کاری نبود.');
    return;
  }

  const values = rows.map((r) => ({
    orderId: r.id,
    userId: r.userId,
    amount: r.amount,
    status: paymentTxStatus(r.paymentStatus),
  }));

  const inserted = await db.insert(payments).values(values).returning({ id: payments.id });

  console.log(`✅ ${inserted.length} ردیف پرداخت برای سفارش‌های قدیمی ساخته شد.`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => {});
  process.exit(1);
});