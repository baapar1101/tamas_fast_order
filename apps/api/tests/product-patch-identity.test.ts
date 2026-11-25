import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changesProductIdentity } from '../src/services/product-duplicates.js';

const existing = {
  productId: '02010104529',
  sku: '02010104529',
  title: 'کاور مگ سیف Redmi Note 15 Pro',
  model: null,
  color: 'میکس',
  colorEn: null,
  type: 'simple',
  digikalaLink: null,
};

test('a price-only edit does not re-run the duplicate check', () => {
  assert.equal(changesProductIdentity(existing, {}), false);
  assert.equal(changesProductIdentity(existing, { title: existing.title, sku: existing.sku }), false);
  assert.equal(changesProductIdentity(existing, { model: null }), false);
});

test('changing a code, title, colour or source link re-runs it', () => {
  assert.equal(changesProductIdentity(existing, { sku: '02010104530' }), true);
  assert.equal(changesProductIdentity(existing, { title: 'کاور دیگر' }), true);
  assert.equal(changesProductIdentity(existing, { color: 'مشکی' }), true);
  assert.equal(changesProductIdentity(existing, { digikalaLink: 'https://www.digikala.com/product/dkp-1/' }), true);
});
