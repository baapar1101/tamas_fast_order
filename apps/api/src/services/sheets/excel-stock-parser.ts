import * as xlsx from '@e965/xlsx';
import { badRequest } from '../../lib/errors.js';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function asciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(FA_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(AR_DIGITS.indexOf(digit)));
}

export function normalizeExcelSku(value: unknown): string {
  return asciiDigits(String(value ?? ''))
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** null means blank/leave unchanged; undefined means invalid. */
export function parseOptionalExcelInteger(value: unknown): number | null | undefined {
  const normalized = asciiDigits(String(value ?? ''))
    .replace(/[٬،,\s]/g, '')
    .trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

export interface ExcelStockRow {
  rowNumber: number;
  displayedSku: string;
  sku: string;
  priceRial: number | null | undefined;
  kermanStock: number | null | undefined;
  tehranStock: number | null | undefined;
}

/** Read actual cell values, not accounting-format display strings or phantom styled rows. */
export function parseExcelStockRows(buffer: Buffer): ExcelStockRow[] {
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

  // Some exports style nearly one million empty rows; !ref then points to the
  // Excel row limit even though only a few hundred rows contain data.
  let lastRealRow = 0;
  for (const [address, cell] of Object.entries(worksheet)) {
    if (!/^[A-D][1-9]\d*$/.test(address) || !cell || cell.v == null || cell.v === '') continue;
    lastRealRow = Math.max(lastRealRow, xlsx.utils.decode_cell(address).r);
  }
  if (lastRealRow < 1) throw badRequest('فایل باید حداقل شامل یک سطر عنوان و یک سطر داده باشد.');
  worksheet['!ref'] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRealRow, c: 3 } });
  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, blankrows: true });
  const header = (rows[0] ?? []).map((value) => String(value ?? '').trim().toLowerCase());
  if (header[0] !== 'sku' || header[1] !== 'price' || header[2] !== 'kerman_stock' || header[3] !== 'tehran_stock') {
    throw badRequest('ستون‌های فایل باید به‌ترتیب sku، price، kerman_stock و tehran_stock باشند.');
  }

  const parsed: ExcelStockRow[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (!row.some((value) => value != null && value !== '')) continue;
    const displayedSku = String(row[0] ?? '').trim();
    parsed.push({
      rowNumber: index + 1,
      displayedSku,
      sku: normalizeExcelSku(displayedSku),
      priceRial: parseOptionalExcelInteger(row[1]),
      kermanStock: parseOptionalExcelInteger(row[2]),
      tehranStock: parseOptionalExcelInteger(row[3]),
    });
  }
  return parsed;
}
