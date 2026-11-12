import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from '@e965/xlsx';
import { matchImportHeaders, normalizeImportValues, productWriteSchema, type ProductImportRowResult } from '@tamas/shared';
import { buildResultWorkbook, buildTemplateWorkbook, parseImportWorkbook, PRODUCTS_SHEET } from '../src/admin/components/productImportExcel';

test('headers are recognised by label, alias or key, loosely', () => {
  const match = matchImportHeaders(['کد محصول *', 'عنوان كالا', 'قیمت فروش (تومان)', 'یادداشت من', 'موجودی', 'Price', '']);
  assert.deepEqual(match.columns.map((c) => c.key), ['productId', 'title', 'price', 'stock']);
  assert.deepEqual(match.ignored, ['یادداشت من']);
  assert.deepEqual(match.duplicates, ['Price']);
  assert.deepEqual(match.missingRequired, []);
  assert.deepEqual(matchImportHeaders(['قیمت']).missingRequired, ['productId', 'title']);
});

test('cell values are cleaned into what the product schema accepts', () => {
  const values = normalizeImportValues({
    productId: '۱۰۴۰۰۱۲۳۴۵',
    title: '  قاب  ',
    price: '۱٬۲۵۰٬۰۰۰',
    stock: 25,
    promotion: 'بله',
    status: 'غیرفعال',
    gallery: 'https://a.test/1.webp | https://a.test/2.webp',
    color: '',
  });
  assert.deepEqual(values, {
    productId: '1040012345', title: 'قاب', price: 1250000, stock: 25, promotion: true, status: 'inactive',
    gallery: ['https://a.test/1.webp', 'https://a.test/2.webp'],
  });
  const parsed = productWriteSchema.parse(values);
  assert.equal(parsed.price, 1250000);
  assert.equal(parsed.promotion, true);
  // A product code typed as a number keeps all its digits.
  assert.equal(normalizeImportValues({ productId: 1040012345 }).productId, '1040012345');
  // Unreadable numbers stay as text so validation names the column.
  assert.equal(productWriteSchema.safeParse(normalizeImportValues({ productId: '1040012345', title: 'x', price: 'زیاد' })).success, false);
});

test('template → filled file → import rows → result file that can be imported again', () => {
  const template = buildTemplateWorkbook(XLSX, ['price', 'stock', 'categoryName'], {
    categories: [{ name: 'case', faName: 'قاب' }],
    brands: [{ name: 'samsung', faName: 'سامسونگ' }],
  });
  const book = XLSX.read(template, { type: 'array' });
  assert.deepEqual(book.SheetNames, [PRODUCTS_SHEET, 'راهنما', 'دسته‌بندی‌ها', 'برندها']);
  const headers = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[PRODUCTS_SHEET]!, { header: 1 })[0];
  assert.deepEqual(headers, ['کد محصول *', 'عنوان کالا *', 'قیمت فروش (تومان)', 'موجودی سایت', 'دسته‌بندی']);

  // The admin fills two rows, leaves a blank line and adds a note column.
  const sheet = book.Sheets[PRODUCTS_SHEET]!;
  XLSX.utils.sheet_add_aoa(sheet, [
    ['1040012345', 'قاب A57', '۱٬۲۵۰٬۰۰۰', 10, 'قاب', 'یادداشت'],
    [],
    ['abc', 'قاب A18', 900000, 5, 'قاب'],
  ], { origin: 'A2' });
  XLSX.utils.sheet_add_aoa(sheet, [['توضیح من']], { origin: 'F1' });
  const filled = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as Uint8Array;

  const parsed = parseImportWorkbook(XLSX, filled);
  assert.equal(parsed.sheetName, PRODUCTS_SHEET);
  assert.deepEqual(parsed.match.ignored, ['توضیح من']);
  assert.deepEqual(parsed.rows.map((row) => row.rowNumber), [2, 4]);
  assert.deepEqual(parsed.rows[0]!.values, { productId: '1040012345', title: 'قاب A57', price: '۱٬۲۵۰٬۰۰۰', stock: 10, categoryName: 'قاب' });

  const results: ProductImportRowResult[] = [
    { rowNumber: 2, status: 'created', productId: '1040012345', title: 'قاب A57', id: 77, message: 'کالا ساخته شد.' },
    { rowNumber: 4, status: 'error', productId: 'abc', title: 'قاب A18', message: 'ستون «کد محصول»: کد محصول باید فقط عدد باشد.' },
  ];
  const resultFile = buildResultWorkbook(XLSX, parsed, results);
  const resultBook = XLSX.read(resultFile, { type: 'array' });
  const resultRows = XLSX.utils.sheet_to_json<unknown[]>(resultBook.Sheets[resultBook.SheetNames[0]!]!, { header: 1 });
  assert.deepEqual(resultRows[0]!.slice(0, 4), ['ردیف در فایل', 'نتیجه', 'توضیح', 'شناسه در سایت']);
  assert.deepEqual(resultRows[1]!.slice(0, 5), [2, 'ایجاد شد', 'کالا ساخته شد.', 77, '1040012345']);
  assert.equal(resultRows[2]![1], 'خطا');

  // Re-importing the result file reads the product columns and ignores the outcome columns.
  const again = parseImportWorkbook(XLSX, resultFile);
  assert.deepEqual(again.match.columns.map((c) => c.key), ['productId', 'title', 'price', 'stock', 'categoryName']);
  assert.equal(again.rows.length, 2);
  assert.equal(again.rows[1]!.values.productId, 'abc');
});

test('a sheet without known headers is rejected with a clear message', () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'Sheet1');
  assert.throws(() => parseImportWorkbook(XLSX, XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as Uint8Array), /سطر عنوان ستون‌ها/);
});

test('the template drops down the site categories and brands and flags typos', () => {
  const file = buildTemplateWorkbook(XLSX, ['price', 'categoryName', 'brandName'], {
    categories: [{ name: 'case', faName: 'قاب' }, { name: 'glass', faName: 'گلس' }],
    brands: [{ name: 'samsung', faName: 'سامسونگ' }],
  });
  const zip = XLSX.CFB.read(file, { type: 'array' });
  const text = (path: string) => new TextDecoder().decode(XLSX.CFB.find(zip, path)!.content as Uint8Array);
  const sheet = text('/xl/worksheets/sheet1.xml');
  // Columns: A code, B title, C price, D category, E brand.
  assert.match(sheet, /<dataValidations count="2">/);
  assert.match(sheet, /sqref="D2:D5001"><formula1>'دسته‌بندی‌ها'!\$A\$2:\$A\$3<\/formula1>/);
  assert.match(sheet, /sqref="E2:E5001"><formula1>'برندها'!\$A\$2:\$A\$2<\/formula1>/);
  assert.match(sheet, /<conditionalFormatting sqref="D2:D5001">.*COUNTIF\('دسته‌بندی‌ها'!\$A\$2:\$A\$3,TRIM\(D2\)\)/);
  assert.ok(sheet.indexOf('<dataValidations') > sheet.indexOf('</sheetData>'));
  assert.ok(sheet.indexOf('<dataValidations') < sheet.indexOf('<ignoredErrors'));
  assert.match(sheet, /rightToLeft="1"/);
  assert.match(text('/xl/styles.xml'), /<dxfs count="1">/);
  // The file still reads back as a normal template.
  const book = XLSX.read(file, { type: 'array' });
  assert.deepEqual(XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[PRODUCTS_SHEET]!, { header: 1 })[0], ['کد محصول *', 'عنوان کالا *', 'قیمت فروش (تومان)', 'دسته‌بندی', 'برند']);
  assert.deepEqual(XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['دسته‌بندی‌ها']!, { header: 1 })[1], ['قاب', 'case']);
  // Without those columns the file is left as SheetJS wrote it.
  const plain = buildTemplateWorkbook(XLSX, ['price'], { categories: [{ name: 'case', faName: 'قاب' }], brands: [] });
  assert.doesNotMatch(new TextDecoder().decode(XLSX.CFB.find(XLSX.CFB.read(plain, { type: 'array' }), '/xl/worksheets/sheet1.xml')!.content as Uint8Array), /dataValidation/);
});
