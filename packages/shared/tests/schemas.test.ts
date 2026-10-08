import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogQuerySchema, idSchema, productCodeSchema, productPatchSchema, sheetBool } from '../src/schemas.js';

describe('shared schemas', () => {
  it('coerces positive integer ids and rejects invalid ids', () => {
    assert.equal(idSchema.parse('42'), 42);
    for (const value of [0, -1, 1.5, '3.14']) assert.throws(() => idSchema.parse(value));
  });

  it('normalizes spreadsheet boolean values', () => {
    for (const value of [true, 1, -1, 'TRUE', ' yes ', 'بله']) assert.equal(sheetBool.parse(value), true);
    for (const value of [false, 0, 'FALSE', 'no', '', null, undefined]) assert.equal(sheetBool.parse(value), false);
  });

  it('requires numeric product codes to start with zero', () => {
    assert.equal(productCodeSchema.parse(' 01010112982 '), '01010112982');
    for (const value of ['1010112982', 'ABC-01', '0', '']) {
      assert.throws(() => productCodeSchema.parse(value));
    }
  });

  it('parses the catalog stock switch from URL query strings', () => {
    assert.equal(catalogQuerySchema.parse({}).inStock, true);
    assert.equal(catalogQuerySchema.parse({ inStock: 'true' }).inStock, true);
    assert.equal(catalogQuerySchema.parse({ inStock: 'false' }).inStock, false);
    assert.equal(catalogQuerySchema.parse({ inStock: false }).inStock, false);
  });

  it('accepts a large curated bundle without allowing unbounded items', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ productId: `0${index + 1}`, qty: 1 }));
    assert.equal(productPatchSchema.parse({ bundleItems: items }).bundleItems?.length, 100);
    assert.throws(() => productPatchSchema.parse({ bundleItems: Array.from({ length: 201 }, () => items[0]) }));
  });
});
