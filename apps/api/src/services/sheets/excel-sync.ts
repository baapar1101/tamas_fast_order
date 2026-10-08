import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { products } from '../../db/schema.js';
import { env } from '../../env.js';
import { badRequest } from '../../lib/errors.js';
import { invalidateCatalog } from '../catalog.js';
import { enqueueCrmProductSync } from '../crm-product-sync.js';
import { parseExcelStockRows, normalizeExcelSku } from './excel-stock-parser.js';
import { runSync } from './sync.js';

export interface ExcelSyncReport {
  totalRows: number;
  updated: number;
  skipped: number;
  errors: string[];
  planHash?: string;
  backupPath?: string;
}

interface UploadOptions {
  dryRun?: boolean;
  expectedPlanHash?: string;
}

/** Blank cells leave existing values intact; an explicit numeric zero clears them. */
export async function processExcelUpload(buffer: Buffer, options: UploadOptions = {}): Promise<ExcelSyncReport> {
  const report: ExcelSyncReport = { totalRows: 0, updated: 0, skipped: 0, errors: [] };
  const rows = parseExcelStockRows(buffer);
  const activeProducts = await db.select({
    id: products.id,
    productId: products.productId,
    sku: products.sku,
    price: products.price,
    stock: products.stock,
    kermanStock: products.kermanStock,
    tehranStock: products.tehranStock,
  }).from(products).where(isNull(products.deletedAt));

  const bySku = new Map<string, typeof activeProducts>();
  for (const product of activeProducts) {
    const key = normalizeExcelSku(product.sku);
    if (!key) continue;
    const matches = bySku.get(key) ?? [];
    matches.push(product);
    bySku.set(key, matches);
  }
  const fileSkuCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.sku) fileSkuCounts.set(row.sku, (fileSkuCounts.get(row.sku) ?? 0) + 1);
  }

  const plan: Array<{
    rowNumber: number;
    product: (typeof activeProducts)[number];
    next: { price: number; kermanStock: number; tehranStock: number; stock: number };
  }> = [];
  for (const row of rows) {
    if (!row.sku) {
      report.errors.push(`ردیف ${row.rowNumber}: کد کالا (SKU) خالی است.`);
      report.skipped += 1;
      continue;
    }
    report.totalRows += 1;
    if ((fileSkuCounts.get(row.sku) ?? 0) > 1) {
      report.errors.push(`ردیف ${row.rowNumber}: کد کالا (SKU) «${row.displayedSku}» در فایل تکراری است.`);
      report.skipped += 1;
      continue;
    }
    const matches = bySku.get(row.sku) ?? [];
    if (matches.length !== 1) {
      report.errors.push(`ردیف ${row.rowNumber}: کد کالا (SKU) «${row.displayedSku}» در سایت ${matches.length ? 'تکراری است' : 'یافت نشد'}.`);
      report.skipped += 1;
      continue;
    }
    if (row.priceRial === undefined || row.kermanStock === undefined || row.tehranStock === undefined) {
      report.errors.push(`ردیف ${row.rowNumber}: قیمت یا موجودی عدد صحیح و نامنفی نیست.`);
      report.skipped += 1;
      continue;
    }
    if (row.priceRial === null && row.kermanStock === null && row.tehranStock === null) {
      report.errors.push(`ردیف ${row.rowNumber}: هیچ مقدار قیمت یا موجودی برای به‌روزرسانی ثبت نشده است.`);
      report.skipped += 1;
      continue;
    }

    const product = matches[0]!;
    const nextKerman = row.kermanStock ?? product.kermanStock;
    const nextTehran = row.tehranStock ?? product.tehranStock;
    const next = {
      price: row.priceRial === null ? product.price : Math.floor(row.priceRial / 10),
      kermanStock: nextKerman,
      tehranStock: nextTehran,
      stock: row.kermanStock === null && row.tehranStock === null ? product.stock : nextKerman + nextTehran,
    };
    if (next.price === product.price && next.kermanStock === product.kermanStock &&
        next.tehranStock === product.tehranStock && next.stock === product.stock) {
      report.skipped += 1;
      continue;
    }
    plan.push({ rowNumber: row.rowNumber, product, next });
  }

  plan.sort((a, b) => a.product.productId.localeCompare(b.product.productId));
  report.planHash = createHash('sha256').update(JSON.stringify(plan.map(({ product, next }) => ({
    productId: product.productId,
    old: [product.price, product.kermanStock, product.tehranStock, product.stock],
    next: [next.price, next.kermanStock, next.tehranStock, next.stock],
  })))).digest('hex');
  report.updated = plan.length;
  if (options.dryRun || plan.length === 0) return report;
  if (options.expectedPlanHash && options.expectedPlanHash !== report.planHash) {
    throw badRequest('داده‌های سایت یا فایل از زمان پیش‌نمایش تغییر کرده‌اند؛ دوباره پیش‌نمایش بگیرید.');
  }

  // This directory is outside the publicly served /uploads/ storage tree.
  const backupDir = resolve(process.cwd(), '.private', 'backups');
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  report.backupPath = resolve(backupDir, `excel-stock-${timestamp}.json`);
  await writeFile(report.backupPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    planHash: report.planHash,
    products: plan.map(({ product, next, rowNumber }) => ({ rowNumber, productId: product.productId, sku: product.sku,
      old: { price: product.price, stock: product.stock, kermanStock: product.kermanStock, tehranStock: product.tehranStock },
      next })),
  }, null, 2), { mode: 0o600 });

  await db.transaction(async (tx) => {
    for (const { product, next } of plan) {
      const [updated] = await tx.update(products).set({ ...next, updatedAt: new Date() })
        .where(and(eq(products.id, product.id), isNull(products.deletedAt),
          eq(products.price, product.price), eq(products.kermanStock, product.kermanStock),
          eq(products.tehranStock, product.tehranStock), eq(products.stock, product.stock)))
        .returning({ id: products.id });
      if (!updated) throw badRequest(`محصول ${product.productId} هم‌زمان تغییر کرده است؛ هیچ‌یک از ردیف‌ها اعمال نشد.`);
    }
  });

  invalidateCatalog();
  for (const { product } of plan) {
    try {
      await enqueueCrmProductSync(product.productId, 'update', { source: 'excel-upload' });
    } catch (error) {
      report.errors.push(`انتشار CRM برای ${product.productId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (env.SHEETS_ENABLED) {
    try {
      const sync = await runSync({ direction: 'push', entities: ['products'], dryRun: false });
      const error = sync.entities.find((entity) => entity.entity === 'products')?.error;
      if (error) report.errors.push(`انتشار در گوگل شیت: ${error}`);
    } catch (error) {
      report.errors.push(`انتشار در گوگل شیت: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return report;
}
