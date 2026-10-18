/**
 * Prefixes every live numeric product code that does not start with zero.
 *
 * Dry run:
 *   npx tsx scripts/repair-product-code-prefixes.ts
 * Apply (creates a JSON backup first):
 *   npx tsx scripts/repair-product-code-prefixes.ts --apply
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { crmSyncLogs, orderItems, products } from '../src/db/schema.js';
import { env } from '../src/env.js';
import { buildSearchText } from '../src/services/catalog.js';
import { enqueueCrmProductSync } from '../src/services/crm-product-sync.js';
import { runSync } from '../src/services/sheets/sync.js';

const apply = process.argv.includes('--apply');

const activeProducts = await db.select().from(products).where(isNull(products.deletedAt));
const rows = activeProducts.filter((row) => !/^0\d+$/.test(row.productId));
const activeCodes = new Set(activeProducts.map((row) => row.productId));
const allCodes = new Set((await db.select({ productId: products.productId }).from(products)).map((row) => row.productId));
const replacements = new Map<string, string>();

for (const row of rows) {
  if (!/^\d+$/.test(row.productId)) {
    throw new Error(`کد فعال غیرعددی است و خودکار قابل اصلاح نیست: ${row.productId}`);
  }
  const next = `0${row.productId}`;
  if (allCodes.has(next)) {
    throw new Error(`کد مقصد از قبل وجود دارد: ${row.productId} -> ${next}`);
  }
  replacements.set(row.productId, next);
}

const invalidOrderItems = await db.select().from(orderItems).where(sql`${orderItems.productId} !~ '^0[0-9]+$'`);
const historicalOrderReplacements = new Map(replacements);
for (const item of invalidOrderItems) {
  if (!/^\d+$/.test(item.productId)) continue;
  const canonicalCode = `0${item.productId}`;
  if (activeCodes.has(canonicalCode)) historicalOrderReplacements.set(item.productId, canonicalCode);
}
const affectedOrderItems = historicalOrderReplacements.size === 0
  ? []
  : await db.select().from(orderItems).where(inArray(orderItems.productId, [...historicalOrderReplacements.keys()]));
const repairableOrderItemIds = new Set(affectedOrderItems.map((item) => item.id));
const unrepairableOrderItems = invalidOrderItems.filter((item) => !repairableOrderItemIds.has(item.id));
const knownInvalidCrmRows = await db
  .select({ entityKey: crmSyncLogs.entityKey, remoteId: crmSyncLogs.remoteId })
  .from(crmSyncLogs)
  .where(and(
    eq(crmSyncLogs.entity, 'product'),
    isNotNull(crmSyncLogs.remoteId),
    sql`${crmSyncLogs.entityKey} !~ '^0[0-9]+$'`,
  ));
const knownInvalidCrmCodes = [...new Set(knownInvalidCrmRows.map((row) => row.entityKey))];

const report = {
  mode: apply ? 'apply' : 'dry-run',
  activeCodesToRepair: rows.length,
  orderItemsToRepair: affectedOrderItems.length,
  unrepairableOrderItems: unrepairableOrderItems.length,
  unrepairableOrderItemSamples: unrepairableOrderItems.slice(0, 10).map((item) => ({
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    sku: item.sku,
    title: item.title,
  })),
  knownInvalidCrmCodesToDelete: knownInvalidCrmCodes.length,
  samples: rows.slice(0, 15).map((row) => ({ from: row.productId, to: replacements.get(row.productId), title: row.title })),
};
console.log(JSON.stringify(report, null, 2));

if (!apply) {
  await closeDb();
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = resolve('storage', 'backups');
await mkdir(backupDir, { recursive: true });
const backupPath = resolve(backupDir, `product-code-prefix-repair-${timestamp}.json`);
await writeFile(backupPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  report,
  products: rows,
  orderItems: affectedOrderItems,
  knownInvalidCrmRows,
}, null, 2), 'utf8');

const allProducts = await db.select().from(products);
const now = new Date();
await db.transaction(async (tx) => {
  for (const row of rows) {
    const next = replacements.get(row.productId)!;
    const nextSku = row.sku === row.productId ? next : row.sku;
    await tx.update(products).set({
      productId: next,
      sku: nextSku,
      searchText: buildSearchText([row.title, row.model, row.color, nextSku, next]),
      updatedAt: now,
    }).where(eq(products.id, row.id));

    await tx.update(products).set({ parentProductId: next, updatedAt: now })
      .where(eq(products.parentProductId, row.productId));
  }

  for (const [oldCode, next] of historicalOrderReplacements) {
    await tx.update(orderItems).set({ productId: next }).where(eq(orderItems.productId, oldCode));
    await tx.update(orderItems).set({ sku: next }).where(eq(orderItems.sku, oldCode));
  }

  for (const product of allProducts) {
    const nextBundle = (product.bundleItems ?? []).map((item) => ({
      ...item,
      productId: replacements.get(item.productId) ?? item.productId,
    }));
    if (nextBundle.some((item, index) => item.productId !== product.bundleItems[index]?.productId)) {
      await tx.update(products).set({ bundleItems: nextBundle, updatedAt: now }).where(eq(products.id, product.id));
    }
  }
});

for (const [oldCode, newCode] of replacements) {
  await enqueueCrmProductSync(oldCode, 'delete', { reason: 'leading-zero-repair', replacedBy: newCode });
  await enqueueCrmProductSync(newCode, 'create', { reason: 'leading-zero-repair', replaced: oldCode });
}
for (const code of knownInvalidCrmCodes) {
  if (!replacements.has(code)) {
    await enqueueCrmProductSync(code, 'delete', { reason: 'site-source-of-truth-reconciliation' });
  }
}

let sheetResult: unknown = { skipped: true, reason: 'SHEETS_ENABLED=false' };
if (env.SHEETS_ENABLED) {
  sheetResult = await runSync({ direction: 'push', entities: ['products'], dryRun: false });
}

console.log(JSON.stringify({ ok: true, backupPath, sheetResult, ...report }, null, 2));
await closeDb();
