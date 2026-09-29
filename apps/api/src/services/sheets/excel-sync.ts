import * as xlsx from 'xlsx';
import { readTab, writeTab } from './client.js';
import { syncPriceStockFromSheet } from './price-stock-sync.js';
import { env } from '../../env.js';
import { badRequest } from '../../lib/errors.js';

export interface ExcelSyncReport {
  totalRows: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function processExcelUpload(buffer: Buffer): Promise<ExcelSyncReport> {
  if (!env.SHEETS_ENABLED) throw badRequest('همگام‌سازی شیت غیرفعال است.');

  const report: ExcelSyncReport = {
    totalRows: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer' });
  } catch (e) {
    throw badRequest('فرمت فایل نامعتبر است. فقط فایل‌های اکسل (xlsx/xls) مجاز هستند.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw badRequest('فایل خالی است.');
  
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw badRequest('تب اکسل نامعتبر است.');
  const jsonRows = xlsx.utils.sheet_to_json<any>(worksheet, { header: 1 }); // Array of Arrays

  if (jsonRows.length < 2) {
    throw badRequest('فایل باید حداقل شامل یک سطر عنوان و یک سطر داده باشد.');
  }

  // Expecting exactly: 1: sku, 2: price, 3: kerman_stock, 4: tehran_stock
  // But let's verify by header or assume order. The user said:
  // "ستون اول sku, ستون دوم price, ستون سوم kerman_stack, ستون چهارم tehran_stack"
  
  // Read current Google Sheet "Products" tab
  const gRows = await readTab('Products');
  if (gRows.length === 0) {
    throw badRequest('تب Products در گوگل شیت یافت نشد یا خالی است.');
  }

  const gHeader = gRows[0]?.map(h => String(h).trim().toLowerCase()) || [];
  const colIdx = {
    sku: gHeader.indexOf('sku'),
    price: gHeader.indexOf('price'),
    kermanStock: gHeader.indexOf('kerman_stock'),
    tehranStock: gHeader.indexOf('tehran_stock'),
  };

  if (colIdx.sku < 0 || colIdx.price < 0 || colIdx.kermanStock < 0 || colIdx.tehranStock < 0) {
    throw badRequest('ستون‌های مورد نیاز (sku, price, kerman_stock, tehran_stock) در گوگل شیت یافت نشد.');
  }

  // Create a map of sku -> row index in Google Sheet
  const skuMap = new Map<string, number>();
  for (let i = 1; i < gRows.length; i++) {
    const row = gRows[i];
    const sku = String(row?.[colIdx.sku] || '').trim();
    if (sku) {
      skuMap.set(sku, i);
    }
  }

  // Process Excel rows (skip header)
  for (let r = 1; r < jsonRows.length; r++) {
    const row = jsonRows[r];
    if (!row || row.length === 0) continue;

    const sku = String(row[0] || '').trim();
    if (!sku) {
      report.skipped++;
      continue;
    }

    report.totalRows++;

    const sheetRowIndex = skuMap.get(sku);
    if (sheetRowIndex === undefined) {
      report.errors.push(`ردیف ${r + 1}: کد کالا (SKU) "${sku}" در گوگل شیت یافت نشد.`);
      report.skipped++;
      if (report.errors.length > 50) break;
      continue;
    }

    // Parse Excel data
    let priceRial = Number(row[1]) || 0;
    const kermanStock = Number(row[2]) || 0;
    const tehranStock = Number(row[3]) || 0;

    // Convert Rial to Toman
    const priceToman = Math.floor(priceRial / 10);

    // Update in memory
    const targetRow = gRows[sheetRowIndex];
    if (!targetRow) continue;
    // Ensure row has enough columns
    const maxNeeded = Math.max(colIdx.price, colIdx.kermanStock, colIdx.tehranStock);
    while (targetRow.length <= maxNeeded) {
      targetRow.push('');
    }

    targetRow[colIdx.price] = String(priceToman);
    targetRow[colIdx.kermanStock] = String(kermanStock);
    targetRow[colIdx.tehranStock] = String(tehranStock);

    report.updated++;
  }

  if (report.updated > 0) {
    // Write back to Google Sheets
    await writeTab('Products', gRows);
    
    // Trigger sync from sheet to DB
    await syncPriceStockFromSheet();
  }

  return report;
}
