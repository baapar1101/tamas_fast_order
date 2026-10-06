import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatMoney, hasRealDiscount, toToman } from '../src/money.js';

describe('money utilities', () => {
  it('formats whole Toman values in Persian', () => {
    assert.equal(formatMoney(10_000), '۱۰٬۰۰۰ تومان');
    assert.equal(formatMoney(null), '۰ تومان');
  });

  it('parses ASCII, Persian, and Arabic-Indic price text', () => {
    assert.equal(toToman('12,345 تومان'), 12_345);
    assert.equal(toToman('۱۲٬۳۴۵ تومان'), 12_345);
    assert.equal(toToman('١٢٬٣٤٥ تومان'), 12_345);
    assert.equal(toToman('invalid'), 0);
  });

  it('recognizes only plausible old prices as real discounts', () => {
    assert.equal(hasRealDiscount(100, 150), true);
    assert.equal(hasRealDiscount(100, 300), true);
    assert.equal(hasRealDiscount(100, 301), false);
    assert.equal(hasRealDiscount(100, 100), false);
    assert.equal(hasRealDiscount(0, 100), false);
    assert.equal(hasRealDiscount(100, Number.NaN), false);
  });
});
