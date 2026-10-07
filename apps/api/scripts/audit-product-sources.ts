/** Read-only audit of product-code consistency across site, Sheet, and CRM queue. */
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { crmSyncLogs, orderItems, products } from '../src/db/schema.js';
import { env } from '../src/env.js';
import { readTab } from '../src/services/sheets/client.js';

const [[active], [invalidActive], invalidOrders, targetRows, [pendingCrm], recentCrmErrors] = await Promise.all([
  db.select({ n: count() }).from(products).where(isNull(products.deletedAt)),
  db.select({ n: count() }).from(products).where(and(
    isNull(products.deletedAt),
    sql`${products.productId} !~ '^0[0-9]+$'`,
  )),
  db.select({ id: orderItems.id, orderId: orderItems.orderId, productId: orderItems.productId })
    .from(orderItems)
    .where(sql`${orderItems.productId} !~ '^0[0-9]+$'`),
  db.select({ productId: products.productId, sku: products.sku, title: products.title })
    .from(products)
    .where(and(
      isNull(products.deletedAt),
      sql`${products.productId} IN ('1010112982', '01010112982')`,
    )),
  db.select({ n: count() }).from(crmSyncLogs).where(and(
    eq(crmSyncLogs.entity, 'product'),
    eq(crmSyncLogs.status, 'pending'),
  )),
  db.select({ entityKey: crmSyncLogs.entityKey, action: crmSyncLogs.action, error: crmSyncLogs.error })
    .from(crmSyncLogs)
    .where(and(eq(crmSyncLogs.entity, 'product'), eq(crmSyncLogs.status, 'error')))
    .orderBy(desc(crmSyncLogs.createdAt))
    .limit(5),
]);

let sheet: Record<string, unknown> = { enabled: env.SHEETS_ENABLED };
if (env.SHEETS_ENABLED) {
  try {
    const rows = await readTab('Products');
    const header = (rows[0] ?? []).map((cell) => String(cell).trim());
    const productIdColumn = header.indexOf('product_id');
    const ids = rows.slice(1).map((row) => String(row[productIdColumn] ?? '').trim()).filter(Boolean);
    sheet = {
      enabled: true,
      rows: ids.length,
      invalidCodes: ids.filter((code) => !/^0\d+$/.test(code)),
      targetPresent: ids.includes('01010112982'),
      oldTargetPresent: ids.includes('1010112982'),
    };
  } catch (error) {
    sheet = { enabled: true, error: error instanceof Error ? error.message : String(error) };
  }
}

console.log(JSON.stringify({
  site: {
    activeProducts: Number(active?.n ?? 0),
    invalidActiveCodes: Number(invalidActive?.n ?? 0),
    targetRows,
  },
  historicalOrders: {
    invalidReferences: invalidOrders,
  },
  sheet,
  crm: {
    pendingProductOperations: Number(pendingCrm?.n ?? 0),
    recentErrors: recentCrmErrors,
  },
}, null, 2));

await closeDb();
