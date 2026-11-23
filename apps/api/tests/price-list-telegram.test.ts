import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as xlsx from '@e965/xlsx';
import type { PriceListDTO } from '@tamas/shared';
import { priceListMessages, priceListWorkbook } from '../src/services/price-list-telegram.js';
import { isPriceUpdateFile, previewText } from '../src/services/telegram-price-update.js';

function list(rowsPerBrand: number, brands = ['سامسونگ', 'اپل']): PriceListDTO {
  return {
    id: 'mobile',
    title: 'لیست قیمت موبایل',
    updatedAt: null,
    pricesHidden: false,
    groups: brands.map((brand) => ({
      brand,
      rows: Array.from({ length: rowsPerBrand }, (_, index) => ({
        productId: `${brand}-${index}`,
        title: `گوشی <مدل> ${index}`,
        color: index % 2 ? 'مشکی' : null,
        price: 10_000_000 + index,
        inStock: index !== 1,
      })),
    })),
  };
}

describe('price lists in Telegram', () => {
  it('lists in-stock rows by brand, escaped, in one message when short', () => {
    const [message, ...rest] = priceListMessages(list(3));
    assert.equal(rest.length, 0);
    assert.match(message!, /لیست قیمت موبایل/);
    assert.match(message!, /🔹 <b>سامسونگ<\/b>/);
    assert.ok(message!.includes('گوشی &lt;مدل&gt; 0'), 'HTML is escaped');
    assert.ok(!message!.includes('گوشی &lt;مدل&gt; 1 '), 'out-of-stock rows are left out');
  });

  it('splits long lists under the Telegram limit without losing rows', () => {
    const messages = priceListMessages(list(400));
    assert.ok(messages.length > 1);
    for (const message of messages) assert.ok(message.length <= 4096, `message of ${message.length} characters`);
    const rows = messages.join('\n').split('\n').filter((line) => line.startsWith('▫️')).length;
    assert.equal(rows, 2 * 399);
  });

  it('says so when nothing is in stock', () => {
    const empty = list(0);
    assert.match(priceListMessages(empty)[0]!, /کالای موجودی/);
  });

  it('builds an Excel copy with every row', () => {
    const book = xlsx.read(priceListWorkbook(list(2)), { type: 'buffer' });
    const rows = xlsx.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]!]!, { header: 1 });
    assert.equal(rows.length, 1 + 4);
    assert.deepEqual(rows[0], ['برند', 'کالا', 'رنگ', 'قیمت (تومان)', 'وضعیت']);
  });

  it('accepts only Excel files and previews changes, suspicious ones first', () => {
    assert.equal(isPriceUpdateFile({ file_id: 'x', file_name: 'Prices.XLSX' }), true);
    assert.equal(isPriceUpdateFile({ file_id: 'x', file_name: 'photo.jpg' }), false);
    const values = (price: number) => ({ price, kermanStock: 1, tehranStock: 0, stock: 1, campaignPoints: 0 });
    const text = previewText('p.xlsx', {
      totalRows: 3, updated: 2, skipped: 1, warnings: 1, errors: [],
      rows: [
        { rowNumber: 2, sku: 'a', status: 'updated', message: '', title: 'عادی', old: values(100), next: values(110) },
        { rowNumber: 3, sku: 'b', status: 'updated', message: '', title: 'کالای پرنوسان', warning: 'قیمت ۹۰٪ کمتر می‌شود.', old: values(1000), next: values(100) },
        { rowNumber: 4, sku: 'c', status: 'error', message: 'کد کالا «c» در سایت یافت نشد.' },
      ],
    });
    assert.match(text, /هنوز چیزی تغییر نکرده/);
    assert.ok(text.includes('⚠️ مشکوک: <b>۱</b>'), 'suspicious count');
    assert.ok(text.indexOf('⚠️ کالای پرنوسان') > -1 && text.indexOf('⚠️ کالای پرنوسان') < text.indexOf('• عادی'), 'suspicious changes come first');
    assert.match(text, /ردیف ۴/);
  });
});
