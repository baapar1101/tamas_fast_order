import { rtlBook } from './productImportExcel';

/** The parts of SheetJS this module uses (loaded lazily by the page, directly by tests). */
type XLSXModule = typeof import('@e965/xlsx');

export type StockUpdateRowStatus = 'updated' | 'unchanged' | 'error';

interface StockValues {
  price: number;
  kermanStock: number;
  tehranStock: number;
  stock: number;
}

export interface StockUpdateRow {
  rowNumber: number;
  sku: string;
  status: StockUpdateRowStatus;
  message: string;
  productId?: string;
  title?: string;
  old?: StockValues;
  next?: StockValues;
}

export interface StockUpdateReport {
  totalRows: number;
  updated: number;
  skipped: number;
  errors: string[];
  /** Missing on reports from an API older than the results export. */
  rows?: StockUpdateRow[];
}

export const STOCK_UPDATE_STATUS_LABELS: Record<StockUpdateRowStatus, string> = {
  updated: 'به‌روز شد',
  unchanged: 'بدون تغییر',
  error: 'خطا',
};

export function countStockRows(rows: StockUpdateRow[] = []): Record<StockUpdateRowStatus, number> {
  const counts = { updated: 0, unchanged: 0, error: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

const HEADERS = [
  'ردیف در فایل', 'کد کالا (SKU)', 'نتیجه', 'توضیح', 'کد محصول', 'عنوان کالا',
  'قیمت قبلی (تومان)', 'قیمت جدید (تومان)',
  'موجودی کرمان قبلی', 'موجودی کرمان جدید',
  'موجودی تهران قبلی', 'موجودی تهران جدید',
  'موجودی کل قبلی', 'موجودی کل جدید',
];
const WIDTHS = [10, 18, 12, 44, 14, 40, 16, 16, 14, 14, 14, 14, 14, 14];

function rowCells(row: StockUpdateRow): unknown[] {
  const pair = (key: keyof StockValues) => [row.old?.[key] ?? '', row.next?.[key] ?? ''];
  return [
    row.rowNumber,
    row.sku,
    STOCK_UPDATE_STATUS_LABELS[row.status],
    row.message,
    row.productId ?? '',
    row.title ?? '',
    ...pair('price'),
    ...pair('kermanStock'),
    ...pair('tehranStock'),
    ...pair('stock'),
  ];
}

/**
 * Results of a bulk price/stock upload: every row with its outcome and the
 * before/after values, the failed rows on their own sheet (to fix and upload
 * again), and a summary that also keeps messages not tied to a row.
 */
export function buildStockUpdateResultWorkbook(XLSX: XLSXModule, report: StockUpdateReport, fileName: string): Uint8Array {
  const rows = report.rows ?? [];
  const book = rtlBook(XLSX);
  const sheet = (data: unknown[][], widths: number[], name: string) => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = widths.map((wch) => ({ wch }));
    if (data.length > 1 && data[0]!.length > 2) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: data[0]!.length - 1 } }) };
    XLSX.utils.book_append_sheet(book, ws, name);
  };

  sheet([HEADERS, ...rows.map(rowCells)], WIDTHS, 'همه ردیف‌ها');
  const failed = rows.filter((row) => row.status === 'error');
  sheet([HEADERS, ...failed.map(rowCells)], WIDTHS, 'خطاها');

  const counts = countStockRows(rows);
  const rowMessages = new Set(rows.filter((row) => row.status === 'error').map((row) => `ردیف ${row.rowNumber}: ${row.message}`));
  const otherMessages = report.errors.filter((message) => !rowMessages.has(message));
  sheet(
    [
      ['خلاصه', ''],
      ['فایل', fileName],
      ['زمان', new Date().toLocaleString('fa-IR')],
      ['ردیف‌های دارای SKU', report.totalRows],
      ['به‌روز شد', counts.updated],
      ['بدون تغییر', counts.unchanged],
      ['خطا', counts.error],
      [],
      ...(otherMessages.length ? [['پیام‌های دیگر', ''], ...otherMessages.map((message) => [message, ''])] : []),
    ],
    [28, 60],
    'خلاصه',
  );
  return XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true }) as Uint8Array;
}
