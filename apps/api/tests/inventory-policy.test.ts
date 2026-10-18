import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateInventory, decideInventoryTransition } from '../src/services/inventory-policy.js';

test('new orders reserve stock and cancellation releases only that reservation', () => {
  assert.deepEqual(decideInventoryTransition('new', 'confirmed'), { valid: true, effect: 'commit' });
  assert.deepEqual(decideInventoryTransition('new', 'cancelled'), { valid: true, effect: 'release' });
  assert.deepEqual(decideInventoryTransition('confirmed', 'cancelled'), { valid: true, effect: 'none' });
});

test('released or committed inventory cannot silently become reserved again', () => {
  assert.deepEqual(decideInventoryTransition('cancelled', 'new'), {
    valid: false,
    reason: 'cancelled_is_terminal',
  });
  assert.deepEqual(decideInventoryTransition('confirmed', 'new'), {
    valid: false,
    reason: 'committed_cannot_be_reserved',
  });
});

test('physical warehouse allocation uses split stock and allocates generic site stock deterministically', () => {
  assert.deepEqual(
    allocateInventory(
      { kermanStock: 5, tehranStock: 4, stock: 9 },
      { kerman: 2, tehran: 1, site: 4 },
    ).allocation,
    { kerman: 5, tehran: 2, site: 0 },
  );
});

test('legacy flat stock is reserved from the site bucket regardless of selected warehouse', () => {
  assert.deepEqual(
    allocateInventory(
      { kermanStock: 0, tehranStock: 0, stock: 8 },
      { kerman: 3, tehran: 2, site: 1 },
    ).allocation,
    { kerman: 0, tehran: 0, site: 6 },
  );
});
