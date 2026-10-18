import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { availableStock } from './catalog.js';

describe('availableStock', () => {
  it('returns the sum of kermanStock and tehranStock when their sum is > 0', () => {
    assert.equal(availableStock({ kermanStock: 5, tehranStock: 10, stock: 20 }), 15);
    assert.equal(availableStock({ kermanStock: 5, tehranStock: 0, stock: 2 }), 5);
    assert.equal(availableStock({ kermanStock: 0, tehranStock: 3, stock: 2 }), 3);
  });

  it('returns the flat stock count when warehouse split sum is 0', () => {
    assert.equal(availableStock({ kermanStock: 0, tehranStock: 0, stock: 20 }), 20);
    assert.equal(availableStock({ kermanStock: 0, tehranStock: 0, stock: 0 }), 0);
  });

  it('returns the flat stock count when warehouse split sum is less than 0', () => {
    assert.equal(availableStock({ kermanStock: -1, tehranStock: -1, stock: 5 }), 5);
    assert.equal(availableStock({ kermanStock: -1, tehranStock: 0, stock: 5 }), 5);
  });
});
