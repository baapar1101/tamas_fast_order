import assert from 'node:assert/strict';
import test from 'node:test';
import { isProductUnavailable } from '../src/store/cart';

test('prices stay visible only while the product is active and has stock', () => {
  assert.equal(isProductUnavailable({ status: 'active', stock: 0, kermanStock: 0, tehranStock: 0 }), true);
  assert.equal(isProductUnavailable({ status: 'active', stock: 0, kermanStock: 1, tehranStock: 0 }), false);
  assert.equal(isProductUnavailable({ status: 'active', stock: 2, kermanStock: 0, tehranStock: 0 }), false);
  assert.equal(isProductUnavailable({ status: 'inactive', stock: 2, kermanStock: 0, tehranStock: 0 }), true);
});
