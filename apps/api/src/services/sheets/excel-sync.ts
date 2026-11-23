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

export type ExcelSyncRowStatus = 'updated' | 'unchanged' | 'error';

interface StockValues {
  price: number;
  kermanStock: number;
  tehranStock: number;
  stock: number;
  campaignPoints: number;
}

/** One line of the uploaded file and what happened to it, for the results spreadsheet. */
export interface ExcelSyncRowResult {
  rowNumber: number;
  sku: string;
  status: ExcelSyncRowStatus;
  message: string;
  /** Applied anyway, but worth a look (for example a price that halved). */
  warning?: string;
  productId?: string;
  title?: string;
  old?: StockValues;
  next?: StockValues;
}

export interface ExcelSyncReport {
  totalRows: number;
  updated: number;
  skipped: number;
  /** Rows that will change and carry a warning. */
  warnings: number;
  errors: string[];
  rows: ExcelSyncRowResult[];
  /** True for a preview: nothing was written. */
  dryRun?: boolean;
  planHash?: string;
  backupPath?: string;
}

interface UploadOptions {
  dryRun?: boolean;
  expectedPlanHash?: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * A price that more than halves or more than doubles is usually a unit slip
 * (toman typed in the rial column) or a typo; the preview points it out.
 */
export function priceChangeWarning(oldPrice: number, newPrice: number): string | undefined {
  if (oldPrice <= 0 || newPrice === oldPrice) return undefined;
  const ratio = newPrice / oldPrice;
  if (ratio > 0.08 && ratio < 0.12) return 'قیمت جدید حدود یک‌دهم قیمت قبلی است؛ شاید قیمت به تومان در ستون ریالی وارد شده است.';
  if (ratio > 8 && ratio < 12) return 'قیمت جدید حدود ده برابر قیمت قبلی است؛ واحد قیمت (ریال/تومان) را بررسی کنید.';
  if (ratio < 0.5) return `قیمت ${Math.round((1 - ratio) * 100)}٪ کمتر می‌شود.`;
  if (ratio > 2) return `قیمت ${Math.round(ratio * 10) / 10} برابر می‌شود.`;
  return undefined;
}

/** Blank cells leave existing values intact; an explicit numeric zero clears stock. */
export async function processExcelUpload(buffer: Buffer, options: UploadOptions = {}): Promise<ExcelSyncReport> {
  const report: ExcelSyncReport = { totalRows: 0, updated: 0, skipped: 0, warnings: 0, errors: [], rows: [] };
  const rows = parseExcelStockRows(buffer);
  const activeProducts = await db.select({
    id: products.id,
    productId: products.productId,
    sku: products.sku,
    title: products.title,
    price: products.price,
    stock: products.stock,
    kermanStock: products.kermanStock,
    tehranStock: products.tehranStock,
    campaignPoints: products.campaignPoints,
  }).from(products).where(isNull(products.deletedAt));

  const bySku = new Map<string, typeof activeProducts>();
  for (const product of activeProducts) {
    const key = normalizeExcelSku(product.sku);
    if (!key) continue;
    const matches = bySku.get(key) ?? [];
    matches.push(product);
    bySku.set(key, matches);
  }
  const byProductId = new Map(activeProducts.map((product) => [product.productId, product]));
  const fileSkuCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.sku) fileSkuCounts.set(row.sku, (fileSkuCounts.get(row.sku) ?? 0) + 1);
  }
  const plannedProducts = new Map<(typeof activeProducts)[number]['id'], number>();

  const plan: Array<{
    rowNumber: number;
    product: (typeof activeProducts)[number];
    next: StockValues;
  }> = [];
  const reject = (row: (typeof rows)[number], message: string, product?: (typeof activeProducts)[number]) => {
    report.errors.push(`ردیف ${row.rowNumber}: ${message}`);
    report.skipped += 1;
    report.rows.push({
      rowNumber: row.rowNumber,
      sku: row.displayedSku,
      status: 'error',
      message,
      ...(product ? { productId: product.productId, title: product.title } : {}),
    });
  };
  for (const row of rows) {
    if (!row.sku && !row.productId) {
      reject(row, 'کد کالا (SKU) خالی است.');
      continue;
    }
    report.totalRows += 1;
    if (row.sku && (fileSkuCounts.get(row.sku) ?? 0) > 1) {
      reject(row, `کد کالا (SKU) «${row.displayedSku}» در فایل تکراری است.`);
      continue;
    }
    const matches = row.sku ? bySku.get(row.sku) ?? [] : [];
    if (matches.length > 1) {
      reject(row, `کد کالا (SKU) «${row.displayedSku}» در سایت تکراری است (${matches.map((item) => item.productId).join('، ')}).`);
      continue;
    }
    // A product without a SKU on the site can still be found by its site code.
    const product = matches[0] ?? (row.productId ? byProductId.get(row.productId) : undefined);
    if (!product) {
      reject(row, `کد کالا «${row.displayedSku}» در سایت یافت نشد.`);
      continue;
    }
    const earlierRow = plannedProducts.get(product.id);
    if (earlierRow !== undefined) {
      reject(row, `این کالا در ردیف ${earlierRow} هم آمده است.`, product);
      continue;
    }
    plannedProducts.set(product.id, row.rowNumber);
    if (row.priceRial === undefined || row.kermanStock === undefined || row.tehranStock === undefined || row.stock === undefined || row.points === undefined) {
      reject(row, 'قیمت، موجودی یا امتیاز عدد نامنفی نیست (موجودی و امتیاز باید عدد صحیح باشند).', product);
      continue;
    }
    if (row.priceRial === null && row.kermanStock === null && row.tehranStock === null && row.stock === null && row.points === null) {
      reject(row, 'هیچ مقدار قیمت، موجودی یا امتیازی برای به‌روزرسانی ثبت نشده است.', product);
      continue;
    }
    const nextPrice = row.priceRial === null ? product.price : Math.floor(row.priceRial / 10);
    if (row.priceRial !== null && nextPrice <= 0) {
      reject(row, 'قیمت صفر ثبت نمی‌شود. برای ناموجود کردن کالا موجودی را صفر کنید.', product);
      continue;
    }

    const nextKerman = row.kermanStock ?? product.kermanStock;
    const nextTehran = row.tehranStock ?? product.tehranStock;
    const warehouseGiven = row.kermanStock !== null || row.tehranStock !== null;
    const next = {
      price: nextPrice,
      kermanStock: nextKerman,
      tehranStock: nextTehran,
      stock: warehouseGiven ? nextKerman + nextTehran : row.stock ?? product.stock,
      campaignPoints: row.points ?? product.campaignPoints,
    };
    const old = { price: product.price, kermanStock: product.kermanStock, tehranStock: product.tehranStock, stock: product.stock, campaignPoints: product.campaignPoints };
    const base = { rowNumber: row.rowNumber, sku: row.displayedSku, productId: product.productId, title: product.title, old, next };
    if (next.price === product.price && next.kermanStock === product.kermanStock &&
        next.tehranStock === product.tehranStock && next.stock === product.stock &&
        next.campaignPoints === product.campaignPoints) {
      report.skipped += 1;
      report.rows.push({ ...base, status: 'unchanged', message: 'قیمت، موجودی و امتیاز همین حالا هم همین است.' });
      continue;
    }
    const warning = priceChangeWarning(product.price, next.price);
    if (warning) report.warnings += 1;
    report.rows.push({ ...base, status: 'updated', message: options.dryRun ? 'تغییر می‌کند.' : 'به‌روز شد.', ...(warning ? { warning } : {}) });
    plan.push({ rowNumber: row.rowNumber, product, next });
  }

  plan.sort((a, b) => a.product.productId.localeCompare(b.product.productId));
  report.planHash = createHash('sha256').update(JSON.stringify(plan.map(({ product, next }) => ({
    productId: product.productId,
    old: [product.price, product.kermanStock, product.tehranStock, product.stock, product.campaignPoints],
    next: [next.price, next.kermanStock, next.tehranStock, next.stock, next.campaignPoints],
  })))).digest('hex');
  report.updated = plan.length;
  report.rows.sort((a, b) => a.rowNumber - b.rowNumber);
  options.onProgress?.(0, plan.length);
  if (options.dryRun) return { ...report, dryRun: true };
  if (plan.length === 0) return report;
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
      old: { price: product.price, stock: product.stock, kermanStock: product.kermanStock, tehranStock: product.tehranStock, campaignPoints: product.campaignPoints },
      next })),
  }, null, 2), { mode: 0o600 });

  await db.transaction(async (tx) => {
    for (const [index, { product, next }] of plan.entries()) {
      const [updated] = await tx.update(products).set({ ...next, updatedAt: new Date() })
        .where(and(eq(products.id, product.id), isNull(products.deletedAt),
          eq(products.price, product.price), eq(products.kermanStock, product.kermanStock),
          eq(products.tehranStock, product.tehranStock), eq(products.stock, product.stock),
          eq(products.campaignPoints, product.campaignPoints)))
        .returning({ id: products.id });
      if (!updated) throw badRequest(`محصول ${product.productId} هم‌زمان تغییر کرده است؛ هیچ‌یک از ردیف‌ها اعمال نشد.`);
      options.onProgress?.(index + 1, plan.length);
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
