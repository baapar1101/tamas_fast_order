import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProductDTO } from '@tamas/shared';
import { parseSheetPatch, sheetCellValue } from '../src/admin/components/productSheetModel.ts';

test('sheet parses Persian digits and grouped prices into numeric patch fields', () => {
  assert.deepEqual(parseSheetPatch({ price: '۱۲,۴۵۰,۰۰۰', kermanStock: '۳', tehranStock: '0', oldPrice: '' }), {
    price: 12_450_000, kermanStock: 3, tehranStock: 0, oldPrice: null,
  });
});

test('sheet rejects invalid cells before writes', () => {
  assert.throws(() => parseSheetPatch({ title: '   ' }), /عنوان محصول/);
  assert.throws(() => parseSheetPatch({ stock: '-1' }), /موجودی کلی/);
  assert.throws(() => parseSheetPatch({ discount: '101' }), /تخفیف/);
  assert.throws(() => parseSheetPatch({ price: '۱۲x' }), /قیمت/);
});

test('sheet represents readable stock without changing warehouse fields', () => {
  const product = { stock: 8, kermanStock: 3, tehranStock: 2, productId: '01010113528' } as ProductDTO;
  assert.equal(sheetCellValue(product, 'totalStock'), '5');
  assert.equal(sheetCellValue(product, 'sku'), '');
  assert.deepEqual(parseSheetPatch({ status: 'inactive', promotion: true }), { status: 'inactive', promotion: true });
});
