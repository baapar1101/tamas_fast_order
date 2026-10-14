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
  const normalized = asciiDigits(String(value ?? ''))
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  return /^\d+$/.test(normalized) && !normalized.startsWith('0') ? `0${normalized}` : normalized;
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

const SUPPORTED_HEADERS = ['sku', 'price', 'kerman_stock', 'tehran_stock'] as const;
type SupportedHeader = (typeof SUPPORTED_HEADERS)[number];

function normalizeHeader(value: unknown): string {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase();
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
  // Excel row limit even though only a few hundred rows contain data. Inspect
  // actual valued cells to find the real bounds instead.
  let lastRealRow = 0;
  let lastRealColumn = 0;
  for (const [address, cell] of Object.entries(worksheet)) {
    if (address.startsWith('!') || !cell || cell.v == null || cell.v === '') continue;
    const position = xlsx.utils.decode_cell(address);
    lastRealRow = Math.max(lastRealRow, position.r);
    lastRealColumn = Math.max(lastRealColumn, position.c);
  }
  if (lastRealRow < 1) throw badRequest('فایل باید حداقل شامل یک سطر عنوان و یک سطر داده باشد.');
  worksheet['!ref'] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRealRow, c: lastRealColumn } });
  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, blankrows: true });
  const header = (rows[0] ?? []).map(normalizeHeader);
  const columnIndexes = new Map<SupportedHeader, number>();
  for (const supportedHeader of SUPPORTED_HEADERS) {
    const indexes = header.flatMap((value, index) => value === supportedHeader ? [index] : []);
    if (indexes.length > 1) throw badRequest(`ستون «${supportedHeader}» در فایل تکراری است.`);
    if (indexes[0] !== undefined) columnIndexes.set(supportedHeader, indexes[0]);
  }
  if (!columnIndexes.has('sku')) throw badRequest('فایل باید ستون sku را برای شناسایی کالا داشته باشد.');
  if (!columnIndexes.has('price') && !columnIndexes.has('kerman_stock') && !columnIndexes.has('tehran_stock')) {
    throw badRequest('فایل باید حداقل یکی از ستون‌های price، kerman_stock یا tehran_stock را داشته باشد.');
  }

  const cell = (row: unknown[], name: SupportedHeader): unknown => {
    const columnIndex = columnIndexes.get(name);
    return columnIndex === undefined ? null : row[columnIndex];
  };

  const parsed: ExcelStockRow[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (!row.some((value) => value != null && value !== '')) continue;
    const displayedSku = String(cell(row, 'sku') ?? '').trim();
    parsed.push({
      rowNumber: index + 1,
      displayedSku,
      sku: normalizeExcelSku(displayedSku),
      priceRial: parseOptionalExcelInteger(cell(row, 'price')),
      kermanStock: parseOptionalExcelInteger(cell(row, 'kerman_stock')),
      tehranStock: parseOptionalExcelInteger(cell(row, 'tehran_stock')),
    });
  }
  return parsed;
}
