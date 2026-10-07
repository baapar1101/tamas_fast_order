import * as xlsx from '@e965/xlsx';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { products } from '../../db/schema.js';
import { env } from '../../env.js';
import { badRequest } from '../../lib/errors.js';
import { invalidateCatalog } from '../catalog.js';
import { enqueueCrmProductSync } from '../crm-product-sync.js';
import { runSync } from './sync.js';

export interface ExcelSyncReport {
  totalRows: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function asciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(FA_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(AR_DIGITS.indexOf(digit)));
}

function normalizeSku(value: unknown): string {
  return asciiDigits(String(value ?? ''))
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function parseInteger(value: unknown): number | null {
  const normalized = asciiDigits(String(value ?? ''))
    .replace(/[٬،,\s]/g, '')
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/** Update the site database first, then publish the result to Sheet and CRM. */
export async function processExcelUpload(buffer: Buffer): Promise<ExcelSyncReport> {
  const report: ExcelSyncReport = { totalRows: 0, updated: 0, skipped: 0, errors: [] };

  let workbook: xlsx.WorkBook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer' });
  } catch {
    throw badRequest('فرمت فایل نامعتبر است. فقط فایل‌های اکسل (xlsx/xls) مجاز هستند.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw badRequest('فایل خالی است.');
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw badRequest('تب اکسل نامعتبر است.');
  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false });
  if (rows.length < 2) {
    throw badRequest('فایل باید حداقل شامل یک سطر عنوان و یک سطر داده باشد.');
  }

  const activeProducts = await db
    .select({ id: products.id, productId: products.productId, sku: products.sku })
    .from(products)
    .where(isNull(products.deletedAt));
  const bySku = new Map<string, typeof activeProducts>();
  for (const product of activeProducts) {
    const key = normalizeSku(product.sku);
    if (!key) continue;
    const matches = bySku.get(key) ?? [];
    matches.push(product);
    bySku.set(key, matches);
  }

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.length === 0) continue;
    const displayedSku = String(row[0] ?? '').trim();
    const sku = normalizeSku(displayedSku);
    if (!sku) {
      report.skipped += 1;
      continue;
    }
    report.totalRows += 1;

    const matches = bySku.get(sku) ?? [];
    if (matches.length === 0) {
      report.errors.push(`ردیف ${index + 1}: کد کالا (SKU) «${displayedSku}» در سایت یافت نشد.`);
      report.skipped += 1;
      continue;
    }
    if (matches.length > 1) {
      report.errors.push(`ردیف ${index + 1}: کد کالا (SKU) «${displayedSku}» در سایت تکراری است.`);
      report.skipped += 1;
      continue;
    }

    const priceRial = parseInteger(row[1]);
    const kermanStock = parseInteger(row[2]);
    const tehranStock = parseInteger(row[3]);
    if (priceRial === null || kermanStock === null || tehranStock === null) {
      report.errors.push(`ردیف ${index + 1}: قیمت یا موجودی عدد معتبر نیست.`);
      report.skipped += 1;
      continue;
    }

    const product = matches[0]!;
    const kerman = Math.max(0, kermanStock);
    const tehran = Math.max(0, tehranStock);
    await db.update(products).set({
      price: Math.max(0, Math.floor(priceRial / 10)),
      kermanStock: kerman,
      tehranStock: tehran,
      stock: kerman + tehran,
      updatedAt: new Date(),
    }).where(eq(products.id, product.id));
    await enqueueCrmProductSync(product.productId, 'update', { source: 'excel-upload' });
    report.updated += 1;
  }

  if (report.updated > 0) {
    invalidateCatalog();
    if (env.SHEETS_ENABLED) {
      const sync = await runSync({ direction: 'push', entities: ['products'], dryRun: false });
      const error = sync.entities.find((entity) => entity.entity === 'products')?.error;
      if (error) report.errors.push(`انتشار در گوگل شیت: ${error}`);
    }
  }

  return report;
}
