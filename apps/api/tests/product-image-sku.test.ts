import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchProductImageSku } from '../src/lib/product-image-sku.js';

describe('product image SKU matching', () => {
  const rows = [
    { id: 1, productId: '02010200244', sku: '02010200244' },
    { id: 2, productId: '010010100002', sku: '010010100002' },
  ];

  it('keeps an exact leading-zero match', () => {
    assert.equal(matchProductImageSku('02010200244', rows).id, 1);
  });

  it('restores one missing leading zero only when the match is unique', () => {
    assert.equal(matchProductImageSku('10010100002', rows).id, 2);
  });

  it('rejects unknown, ambiguous, and nonnumeric names', () => {
    assert.throws(() => matchProductImageSku('123', rows), /پیدا نشد/);
    assert.throws(() => matchProductImageSku('image', rows), /عددی/);
    assert.throws(() => matchProductImageSku('02010200244', [...rows, { id: 3, productId: '02010200244', sku: null }]), /چند محصول/);
  });
});
