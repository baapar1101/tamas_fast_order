import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as xlsx from '@e965/xlsx';
import { normalizeExcelSku, parseExcelStockRows, parseOptionalExcelInteger } from '../src/services/sheets/excel-stock-parser.js';

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
    assert.deepEqual(rows[0], { rowNumber: 2, displayedSku: '01020100127', sku: '01020100127',
      priceRial: null, kermanStock: 4, tehranStock: null });
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
  });
});
