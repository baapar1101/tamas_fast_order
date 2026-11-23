import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as xlsx from '@e965/xlsx';
import {
  normalizeExcelSku,
  parseExcelStockRows,
  parseOptionalExcelAmount,
  parseOptionalExcelInteger,
} from '../src/services/sheets/excel-stock-parser.js';
import { priceChangeWarning } from '../src/services/sheets/excel-sync.js';

describe('Excel stock input', () => {
  it('preserves leading-zero SKUs and treats blank price/stock as unchanged', () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['sku', 'price', 'kerman_stock', 'tehran_stock'],
      ['01020100127', null, 4, null],
      ['۰۱۰۲۰۱۰۰۱۲۹', null, 0, null],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Prices');
    const rows = parseExcelStockRows(Buffer.from(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { rowNumber: 2, displayedSku: '01020100127', sku: '01020100127', productId: '',
      priceRial: null, kermanStock: 4, tehranStock: null, stock: null, points: null });
    assert.equal(rows[1]?.sku, '01020100129');
    assert.equal(rows[1]?.kermanStock, 0);
  });

  it('rejects invalid numbers but accepts zero and formatted-looking text', () => {
    assert.equal(parseOptionalExcelInteger(''), null);
    assert.equal(parseOptionalExcelInteger(null), null);
    assert.equal(parseOptionalExcelInteger(' ۴ '), 4);
    assert.equal(parseOptionalExcelInteger('۰'), 0);
    assert.equal(parseOptionalExcelInteger('1,234'), 1234);
    assert.equal(parseOptionalExcelInteger('-1'), undefined);
    assert.equal(parseOptionalExcelInteger('1.5'), undefined);
    assert.equal(normalizeExcelSku(' ۰۱۰۲۰۱۰۰۱۲۷\u200b '), '01020100127');
    assert.equal(normalizeExcelSku('10010100063'), '010010100063');
    assert.equal(normalizeExcelSku('۰۲۰۳۰۵۰۰۰۹۴'), '02030500094');
    assert.equal(normalizeExcelSku('SKU-1001'), 'sku-1001');
  });

  it('automatically restores a missing leading zero in an Excel SKU', () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['price', 'sku'],
      [1_500_000, '10010100063'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Prices');

    const [row] = parseExcelStockRows(Buffer.from(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })));
    assert.equal(row?.displayedSku, '10010100063');
    assert.equal(row?.sku, '010010100063');
    assert.equal(row?.priceRial, 1_500_000);
  });

  it('accepts any supported subset in any order and ignores extra columns', () => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([
      ['title', 'tehran_stock', 'sku', 'notes'],
      ['محصول نمونه', 7, '01020100127', 'بدون تغییر قیمت و موجودی کرمان'],
    ]);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Stock');

    const rows = parseExcelStockRows(Buffer.from(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })));
    assert.deepEqual(rows, [{
      rowNumber: 2,
      displayedSku: '01020100127',
      sku: '01020100127',
      productId: '',
      priceRial: null,
      kermanStock: null,
      tehranStock: 7,
      stock: null,
      points: null,
    }]);
  });

  it('reads Persian headers, toman prices, formula fractions and site stock', () => {
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['کد کالا', 'قیمت (تومان)', 'موجودی', 'شناسه محصول'],
      ['10010100063', '۱٬۲۵۰٬۰۰۰ تومان', 3, null],
      [null, 99_999.6, null, '12345678'],
    ]), 'Sheet1');
    const rows = parseExcelStockRows(Buffer.from(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })));
    assert.equal(rows[0]?.sku, '010010100063');
    assert.equal(rows[0]?.priceRial, 12_500_000);
    assert.equal(rows[0]?.stock, 3);
    assert.equal(rows[1]?.productId, '12345678');
    assert.equal(rows[1]?.displayedSku, '12345678');
    assert.equal(rows[1]?.priceRial, 1_000_000);
    assert.equal(parseOptionalExcelAmount('1,500,000 ریال'), 1_500_000);
    assert.equal(parseOptionalExcelAmount('abc'), undefined);
    assert.equal(parseOptionalExcelAmount(-5), undefined);
  });

  it('ignores the site stock column when warehouse columns are present', () => {
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['sku', 'stock', 'tehran_stock'],
      ['1001', 9, 2],
    ]), 'Sheet1');
    const [row] = parseExcelStockRows(Buffer.from(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })));
    assert.equal(row?.stock, null);
    assert.equal(row?.tehranStock, 2);
  });

  it('reads campaign points', () => {
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['کد کالا', 'امتیاز'],
      ['1001', 15],
    ]), 'Sheet1');
    const [row] = parseExcelStockRows(Buffer.from(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })));
    assert.equal(row?.points, 15);
    assert.equal(row?.priceRial, null);
  });

  it('refuses a file with both rial and toman price columns', () => {
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ['sku', 'price', 'قیمت (تومان)'],
      ['1001', 10, 1],
    ]), 'Sheet1');
    assert.throws(() => parseExcelStockRows(Buffer.from(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }))), /فقط یکی/);
  });

  it('flags suspicious price changes', () => {
    assert.match(priceChangeWarning(1_000_000, 100_000) ?? '', /تومان/);
    assert.match(priceChangeWarning(100_000, 1_000_000) ?? '', /ده برابر/);
    assert.match(priceChangeWarning(1_000_000, 400_000) ?? '', /60٪/);
    assert.equal(priceChangeWarning(1_000_000, 1_200_000), undefined);
    assert.equal(priceChangeWarning(0, 500_000), undefined);
  });

  it('requires sku and at least one editable column', () => {
    const workbookWithoutSku = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbookWithoutSku, xlsx.utils.aoa_to_sheet([
      ['price'],
      [1000],
    ]), 'Prices');
    assert.throws(
      () => parseExcelStockRows(Buffer.from(xlsx.write(workbookWithoutSku, { type: 'buffer', bookType: 'xlsx' }))),
      /ستون sku/,
    );

    const workbookWithoutValue = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbookWithoutValue, xlsx.utils.aoa_to_sheet([
      ['sku', 'title'],
      ['1001', 'محصول'],
    ]), 'Products');
    assert.throws(
      () => parseExcelStockRows(Buffer.from(xlsx.write(workbookWithoutValue, { type: 'buffer', bookType: 'xlsx' }))),
      /حداقل یکی از ستون‌های/,
    );
  });
});
