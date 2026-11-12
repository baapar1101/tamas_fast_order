import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from '@e965/xlsx';
import { buildStockUpdateResultWorkbook, countStockRows, type StockUpdateReport } from '../src/admin/components/stockUpdateExcel';

const report: StockUpdateReport = {
  totalRows: 3,
  updated: 1,
  skipped: 2,
  errors: ['ردیف 3: کد کالا (SKU) «0201» در سایت یافت نشد.', 'انتشار در گوگل شیت: timeout'],
  rows: [
    { rowNumber: 2, sku: 'A1', status: 'updated', message: 'به‌روز شد.', productId: '1040', title: 'قاب', old: { price: 100, kermanStock: 1, tehranStock: 2, stock: 3 }, next: { price: 120, kermanStock: 5, tehranStock: 2, stock: 7 } },
    { rowNumber: 3, sku: '0201', status: 'error', message: 'کد کالا (SKU) «0201» در سایت یافت نشد.' },
    { rowNumber: 4, sku: 'B2', status: 'unchanged', message: 'قیمت و موجودی همین حالا هم همین است.', productId: '1041', title: 'گلس', old: { price: 50, kermanStock: 0, tehranStock: 0, stock: 0 }, next: { price: 50, kermanStock: 0, tehranStock: 0, stock: 0 } },
  ],
};

test('stock update results become a sheet per outcome with before/after values', () => {
  assert.deepEqual(countStockRows(report.rows), { updated: 1, unchanged: 1, error: 1 });
  const book = XLSX.read(buildStockUpdateResultWorkbook(XLSX, report, 'prices.xlsx'), { type: 'array' });
  assert.deepEqual(book.SheetNames, ['همه ردیف‌ها', 'خطاها', 'خلاصه']);
  const all = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['همه ردیف‌ها']!, { header: 1 });
  assert.equal(all.length, 4);
  assert.deepEqual(all[1], [2, 'A1', 'به‌روز شد', 'به‌روز شد.', '1040', 'قاب', 100, 120, 1, 5, 2, 2, 3, 7]);
  // SKUs with leading zeros stay text.
  assert.equal(all[2]![1], '0201');
  const failed = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['خطاها']!, { header: 1 });
  assert.deepEqual(failed.slice(1).map((row) => row[0]), [3]);
  const summary = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['خلاصه']!, { header: 1 });
  assert.ok(summary.some((row) => row[0] === 'بدون تغییر' && row[1] === 1));
  // Messages not tied to a row are kept; row errors are not repeated there.
  assert.ok(summary.some((row) => row[0] === 'انتشار در گوگل شیت: timeout'));
  assert.ok(!summary.some((row) => String(row[0]).startsWith('ردیف 3')));
  assert.equal(book.Workbook?.Views?.[0]?.RTL, true);
});
