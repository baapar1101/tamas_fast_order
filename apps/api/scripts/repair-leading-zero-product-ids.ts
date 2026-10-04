/**
 * Repairs product rows duplicated after Google Sheets stripped a leading zero.
 *
 * Dry run:
 *   npx tsx scripts/repair-leading-zero-product-ids.ts
 * Apply (creates a JSON backup first):
 *   npx tsx scripts/repair-leading-zero-product-ids.ts --apply
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { eq, inArray, isNull } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { comments, products, productTrackingLinks } from '../src/db/schema.js';
import { env } from '../src/env.js';
import { normalizeProductIdentity } from '../src/services/product-identity.js';
import { sheetsClient } from '../src/services/sheets/client.js';

interface SheetProductRow {
  rowNumber: number;
  productId: string;
  title: string;
  values: unknown[];
}

const apply = process.argv.includes('--apply');
const numericKey = (value: string): string | null =>
  /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, '') : null;

function collisionGroups<T extends { productId: string; title: string }>(items: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = numericKey(item.productId);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => {
    if (new Set(group.map((item) => item.productId)).size < 2) return false;
    return new Set(group.map((item) => normalizeProductIdentity(item.title))).size === 1;
  });
}

function canonical<T extends { productId: string }>(group: T[]): T {
  return [...group].sort((a, b) => b.productId.length - a.productId.length)[0]!;
}

const api = await sheetsClient();
const spreadsheet = await api.spreadsheets.get({
  spreadsheetId: env.SHEETS_SPREADSHEET_ID,
  fields: 'sheets.properties',
});
const productSheet = spreadsheet.data.sheets?.find((sheet) => sheet.properties?.title === 'Products');
const sheetId = productSheet?.properties?.sheetId;
if (sheetId == null) throw new Error('تب Products در گوگل شیت پیدا نشد.');

const sheetResponse = await api.spreadsheets.values.get({
  spreadsheetId: env.SHEETS_SPREADSHEET_ID,
  range: 'Products!A1:ZZ',
  valueRenderOption: 'FORMATTED_VALUE',
  dateTimeRenderOption: 'FORMATTED_STRING',
});
const sheetValues = sheetResponse.data.values ?? [];
const header = (sheetValues[0] ?? []).map((value) => String(value).trim());
const productIdColumn = header.indexOf('product_id');
const titleColumn = header.indexOf('title');
if (productIdColumn < 0 || titleColumn < 0) throw new Error('ستون product_id یا title در شیت پیدا نشد.');

const sheetRows: SheetProductRow[] = sheetValues.slice(1).flatMap((values, index) => {
  const productId = String(values[productIdColumn] ?? '').trim();
  if (!productId) return [];
  return [{
    rowNumber: index + 2,
    productId,
    title: String(values[titleColumn] ?? '').trim(),
    values,
  }];
});

const dbRows = await db.select().from(products).where(isNull(products.deletedAt));
const sheetGroups = collisionGroups(sheetRows);
const dbGroups = collisionGroups(dbRows);
const sheetIds = new Set(sheetGroups.flatMap((group) => group.map((row) => row.productId)));
const dbIds = new Set(dbGroups.flatMap((group) => group.map((row) => row.productId)));
if (sheetIds.size !== dbIds.size || [...sheetIds].some((id) => !dbIds.has(id))) {
  throw new Error('جفت‌های تکراری شیت و دیتابیس یکسان نیستند؛ عملیات متوقف شد.');
}

const sheetRowsToDelete = sheetGroups.flatMap((group) => {
  const keep = canonical(group);
  if (!keep.productId.startsWith('0')) throw new Error(`کد مرجع صفر ابتدایی ندارد: ${keep.productId}`);
  return group.filter((row) => row !== keep);
});
const dbRowsToDelete = dbGroups.flatMap((group) => {
  const keep = canonical(group);
  if (!keep.productId.startsWith('0')) throw new Error(`کد مرجع صفر ابتدایی ندارد: ${keep.productId}`);
  return group.filter((row) => row.id !== keep.id).map((row) => ({ row, keep }));
});

const report = {
  mode: apply ? 'apply' : 'dry-run',
  sheetRows: sheetRows.length,
  liveDatabaseRows: dbRows.length,
  collisionGroups: sheetGroups.length,
  sheetRowsToDelete: sheetRowsToDelete.length,
  databaseRowsToSoftDelete: dbRowsToDelete.length,
};
console.log(JSON.stringify(report, null, 2));

if (!apply) {
  await closeDb();
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = resolve('storage', 'backups');
await mkdir(backupDir, { recursive: true });
const backupPath = resolve(backupDir, `leading-zero-repair-${timestamp}.json`);
await writeFile(backupPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  spreadsheetId: env.SHEETS_SPREADSHEET_ID,
  report,
  header,
  removedSheetRows: sheetRowsToDelete,
  softDeletedDatabaseRows: dbRowsToDelete.map(({ row, keep }) => ({ row, keptProductId: keep.productId, keptDatabaseId: keep.id })),
}, null, 2), 'utf8');

// Delete bottom-up so earlier row indexes remain valid. Chunking keeps each
// Google API request comfortably below its operation limit.
const deleteRequests = [...sheetRowsToDelete]
  .sort((a, b) => b.rowNumber - a.rowNumber)
  .map((row) => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS' as const, startIndex: row.rowNumber - 1, endIndex: row.rowNumber },
    },
  }));
for (let offset = 0; offset < deleteRequests.length; offset += 200) {
  await api.spreadsheets.batchUpdate({
    spreadsheetId: env.SHEETS_SPREADSHEET_ID,
    requestBody: { requests: deleteRequests.slice(offset, offset + 200) },
  });
}

const now = new Date();
await db.transaction(async (tx) => {
  const wrongIds = dbRowsToDelete.map(({ row }) => row.id);
  if (wrongIds.length > 0) {
    await tx.update(products).set({ status: 'inactive', deletedAt: now, updatedAt: now }).where(inArray(products.id, wrongIds));
  }

  for (const { row, keep } of dbRowsToDelete) {
    await tx.update(products).set({ parentProductId: keep.productId, updatedAt: now }).where(eq(products.parentProductId, row.productId));
    await tx.update(comments).set({ productId: keep.id, updatedAt: now }).where(eq(comments.productId, row.id));

    const [keptLinks, wrongLinks] = await Promise.all([
      tx.select().from(productTrackingLinks).where(eq(productTrackingLinks.productDbId, keep.id)),
      tx.select().from(productTrackingLinks).where(eq(productTrackingLinks.productDbId, row.id)),
    ]);
    const occupiedSites = new Set(keptLinks.map((link) => link.siteId));
    for (const link of wrongLinks) {
      if (!occupiedSites.has(link.siteId)) {
        await tx.update(productTrackingLinks).set({ productDbId: keep.id, updatedAt: now }).where(eq(productTrackingLinks.id, link.id));
        occupiedSites.add(link.siteId);
      }
    }
  }

  const replacement = new Map(dbRowsToDelete.map(({ row, keep }) => [row.productId, keep.productId]));
  for (const product of dbRows) {
    const next = (product.bundleItems ?? []).map((item) => ({ ...item, productId: replacement.get(item.productId) ?? item.productId }));
    if (next.some((item, index) => item.productId !== product.bundleItems[index]?.productId)) {
      await tx.update(products).set({ bundleItems: next, updatedAt: now }).where(eq(products.id, product.id));
    }
  }
});

console.log(JSON.stringify({ ok: true, backupPath, ...report }, null, 2));
await closeDb();
