import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { duplicateProductMessage, type ProductDuplicate } from '../src/services/product-duplicates.js';

describe('duplicateProductMessage', () => {
  const baseDuplicate: Omit<ProductDuplicate, 'reason'> = {
    id: 1,
    productId: '12345',
    title: 'تست محصول',
  };

  it('formats correctly for reason: productId', () => {
    const duplicate: ProductDuplicate = { ...baseDuplicate, reason: 'productId' };
    assert.equal(
      duplicateProductMessage(duplicate),
      'کالای تکراری است: «تست محصول» با کد 12345 قبلاً ثبت شده (تطابق کد کالا).'
    );
  });

  it('formats correctly for reason: sku', () => {
    const duplicate: ProductDuplicate = { ...baseDuplicate, reason: 'sku' };
    assert.equal(
      duplicateProductMessage(duplicate),
      'کالای تکراری است: «تست محصول» با کد 12345 قبلاً ثبت شده (تطابق SKU).'
    );
  });

  it('formats correctly for reason: source', () => {
    const duplicate: ProductDuplicate = { ...baseDuplicate, reason: 'source' };
    assert.equal(
      duplicateProductMessage(duplicate),
      'کالای تکراری است: «تست محصول» با کد 12345 قبلاً ثبت شده (تطابق لینک منبع).'
    );
  });

  it('formats correctly for reason: identity', () => {
    const duplicate: ProductDuplicate = { ...baseDuplicate, reason: 'identity' };
    assert.equal(
      duplicateProductMessage(duplicate),
      'کالای تکراری است: «تست محصول» با کد 12345 قبلاً ثبت شده (تطابق عنوان، مدل و رنگ).'
    );
  });
});
