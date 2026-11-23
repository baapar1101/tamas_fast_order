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

/**
 * A price cell: thousand separators, a unit word ("ریال", "تومان") and the
 * fraction a formula may leave (1500000.4) are accepted; the amount is
 * rounded. null means blank; undefined means not a number.
 */
export function parseOptionalExcelAmount(value: unknown): number | null | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return undefined;
    const rounded = Math.round(value);
    return Number.isSafeInteger(rounded) ? rounded : undefined;
  }
  const normalized = asciiDigits(String(value ?? ''))
    .replace(/(ریال|تومان|rials?|tomans?|irr|irt)/gi, '')
    .replace(/[٬،,\s]/g, '')
    .replace(/٫/g, '.')
    .trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined;
  const rounded = Math.round(Number(normalized));
  return Number.isSafeInteger(rounded) ? rounded : undefined;
}

export interface ExcelStockRow {
  rowNumber: number;
  displayedSku: string;
  sku: string;
  /** The site's product code, used when the row has no SKU or it does not match. */
  productId: string;
  priceRial: number | null | undefined;
  kermanStock: number | null | undefined;
  tehranStock: number | null | undefined;
  /** Site stock; read only when the file has no warehouse columns. */
  stock?: number | null | undefined;
}

const SUPPORTED_HEADERS = ['sku', 'product_id', 'price', 'price_toman', 'kerman_stock', 'tehran_stock', 'stock'] as const;
type SupportedHeader = (typeof SUPPORTED_HEADERS)[number];

/** Lower case; no spaces, underscores, brackets or zero-width characters; Persian ی and ک. */
function normalizeHeader(value: unknown): string {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\s_\-()[\]{}:.\u200b-\u200f\u2060\ufeff]/g, '');
}

const HEADER_ALIASES: Record<SupportedHeader, string[]> = {
  sku: ['sku', 'کد کالا', 'کد محصول', 'کد', 'code', 'item code'],
  product_id: ['product_id', 'شناسه محصول', 'شناسه کالا', 'کد سایت'],
  price: ['price', 'price_rial', 'قیمت', 'قیمت (ریال)', 'قیمت ریالی', 'قیمت فروش', 'قیمت فروش (ریال)'],
  price_toman: ['price_toman', 'قیمت (تومان)', 'قیمت تومانی', 'قیمت فروش (تومان)'],
  kerman_stock: ['kerman_stock', 'موجودی کرمان', 'انبار کرمان'],
  tehran_stock: ['tehran_stock', 'موجودی تهران', 'انبار تهران'],
  stock: ['stock', 'موجودی', 'موجودی سایت', 'موجودی کل'],
};
const HEADER_LOOKUP = new Map<string, SupportedHeader>(
  (Object.entries(HEADER_ALIASES) as Array<[SupportedHeader, string[]]>)
    .flatMap(([key, aliases]) => aliases.map((alias) => [normalizeHeader(alias), key] as const)),
);

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
  const header = (rows[0] ?? []).map((value) => HEADER_LOOKUP.get(normalizeHeader(value)));
  const columnIndexes = new Map<SupportedHeader, number>();
  for (const supportedHeader of SUPPORTED_HEADERS) {
    const indexes = header.flatMap((value, index) => value === supportedHeader ? [index] : []);
    if (indexes.length > 1) throw badRequest(`ستون «${supportedHeader}» در فایل تکراری است.`);
    if (indexes[0] !== undefined) columnIndexes.set(supportedHeader, indexes[0]);
  }
  if (!columnIndexes.has('sku') && !columnIndexes.has('product_id')) {
    throw badRequest('فایل باید ستون sku (کد کالا) را برای شناسایی کالا داشته باشد.');
  }
  if (columnIndexes.has('price') && columnIndexes.has('price_toman')) {
    throw badRequest('فایل هم قیمت ریالی (price) و هم قیمت تومانی (price_toman) دارد؛ فقط یکی را نگه دارید.');
  }
  const valueColumns: SupportedHeader[] = ['price', 'price_toman', 'kerman_stock', 'tehran_stock', 'stock'];
  if (!valueColumns.some((name) => columnIndexes.has(name))) {
    throw badRequest('فایل باید حداقل یکی از ستون‌های price، price_toman، kerman_stock، tehran_stock یا stock را داشته باشد.');
  }
  const hasWarehouseColumns = columnIndexes.has('kerman_stock') || columnIndexes.has('tehran_stock');
  const tomanPrices = columnIndexes.has('price_toman');

  const cell = (row: unknown[], name: SupportedHeader): unknown => {
    const columnIndex = columnIndexes.get(name);
    return columnIndex === undefined ? null : row[columnIndex];
  };

  const parsed: ExcelStockRow[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (!row.some((value) => value != null && value !== '')) continue;
    const displayedSku = String(cell(row, 'sku') ?? '').trim();
    const productId = asciiDigits(String(cell(row, 'product_id') ?? '')).replace(/\s+/g, '');
    const toman = tomanPrices ? parseOptionalExcelAmount(cell(row, 'price_toman')) : null;
    parsed.push({
      rowNumber: index + 1,
      displayedSku: displayedSku || productId,
      sku: normalizeExcelSku(displayedSku),
      productId,
      priceRial: tomanPrices ? (toman == null ? toman : toman * 10) : parseOptionalExcelAmount(cell(row, 'price')),
      kermanStock: parseOptionalExcelInteger(cell(row, 'kerman_stock')),
      tehranStock: parseOptionalExcelInteger(cell(row, 'tehran_stock')),
      ...(columnIndexes.has('stock') && !hasWarehouseColumns ? { stock: parseOptionalExcelInteger(cell(row, 'stock')) } : {}),
    });
  }
  return parsed;
}
