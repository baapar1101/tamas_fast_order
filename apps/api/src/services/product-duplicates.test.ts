import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { duplicateProductMessage, type ProductDuplicate } from './product-duplicates.js';

describe('duplicateProductMessage', () => {
  it('should format message for productId reason', () => {
    const duplicate: ProductDuplicate = {
      id: 1,
      productId: 'P123',
      title: 'Sample Product',
      reason: 'productId',
    };
    const message = duplicateProductMessage(duplicate);
    assert.equal(message, 'کالای تکراری است: «Sample Product» با کد P123 قبلاً ثبت شده (تطابق کد کالا).');
  });

  it('should format message for sku reason', () => {
    const duplicate: ProductDuplicate = {
      id: 2,
      productId: 'P124',
      title: 'Another Product',
      reason: 'sku',
    };
    const message = duplicateProductMessage(duplicate);
    assert.equal(message, 'کالای تکراری است: «Another Product» با کد P124 قبلاً ثبت شده (تطابق SKU).');
  });

  it('should format message for source reason', () => {
    const duplicate: ProductDuplicate = {
      id: 3,
      productId: 'P125',
      title: 'Source Product',
      reason: 'source',
    };
    const message = duplicateProductMessage(duplicate);
    assert.equal(message, 'کالای تکراری است: «Source Product» با کد P125 قبلاً ثبت شده (تطابق لینک منبع).');
  });

  it('should format message for identity reason', () => {
    const duplicate: ProductDuplicate = {
      id: 4,
      productId: 'P126',
      title: 'Identity Product',
      reason: 'identity',
    };
    const message = duplicateProductMessage(duplicate);
    assert.equal(message, 'کالای تکراری است: «Identity Product» با کد P126 قبلاً ثبت شده (تطابق عنوان، مدل و رنگ).');
  });
});
