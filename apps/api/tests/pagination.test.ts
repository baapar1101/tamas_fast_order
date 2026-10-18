import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { offsetOf, paged } from '../src/lib/pagination.js';

describe('pagination utilities', () => {
  it('calculates offsets for valid pages', () => {
    assert.equal(offsetOf({ page: 1, perPage: 10 }), 0);
    assert.equal(offsetOf({ page: 2, perPage: 10 }), 10);
    assert.equal(offsetOf({ page: 3, perPage: 25 }), 50);
  });

  it('wraps items with pagination metadata', () => {
    assert.deepEqual(paged(['a', 'b'], 12, { page: 2, perPage: 2 }), {
      items: ['a', 'b'],
      total: 12,
      page: 2,
      perPage: 2,
    });
  });
});
