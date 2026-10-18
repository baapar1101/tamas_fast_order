import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProductDTO } from '@tamas/shared';
import { isPhoneMediaOnlyProduct, isPhoneProduct, phoneDefaultVariantIndex, phoneDisplayVariants, phoneModelImages } from '../src/storefront/productVariants.ts';

function product(fields: Partial<ProductDTO>): ProductDTO {
  return {
    productId: '01010110000',
    categoryName: 'Mobile phones',
    categoryFaName: 'گوشی موبایل',
    color: null,
    colorEn: null,
    sku: null,
    price: 0,
    stock: 0,
    kermanStock: 0,
    tehranStock: 0,
    imageUrl: null,
    gallery: [],
    status: 'active',
    ...fields,
  } as ProductDTO;
}

test('a model photo row is not counted as a black phone colour', () => {
  const media = product({ productId: '01010113214', sku: '', imageUrl: '/phone.webp', gallery: ['/side.webp'] });
  const green = product({ productId: '01010113215', color: 'سبز', sku: '01010113215' });
  const black = product({ productId: '01010113222', color: 'مشکی', sku: '01010113222', price: 48499000 });
  const purple = product({ productId: '01010113369', color: 'بنفش', sku: '01010113369' });

  assert.equal(isPhoneProduct(media), true);
  assert.equal(isPhoneMediaOnlyProduct(media), true);
  const visible = phoneDisplayVariants([purple, media, black, green]);
  assert.deepEqual(visible.map((v) => v.color), ['بنفش', 'مشکی', 'سبز']);
  assert.equal(visible[phoneDefaultVariantIndex(visible)]?.productId, black.productId);
  assert.deepEqual(phoneModelImages([purple, media, black, green]), ['/phone.webp', '/side.webp']);
});

test('equivalent colour spellings show one swatch and prefer the buyable SKU', () => {
  const unavailable = product({ productId: '1', color: 'مشكي', price: 0 });
  const available = product({ productId: '2', color: ' مشکی ', sku: '2', price: 100, stock: 3 });

  assert.deepEqual(phoneDisplayVariants([unavailable, available]).map((v) => v.productId), ['2']);
});

test('an uncoloured but priced phone remains a real product', () => {
  const phone = product({ productId: '3', sku: '3', price: 100, stock: 1, imageUrl: '/phone.webp' });

  assert.equal(isPhoneMediaOnlyProduct(phone), false);
  assert.deepEqual(phoneDisplayVariants([phone]), [phone]);
});

test('phone images are model-wide and independent of the selected colour', () => {
  const red = product({ productId: '4', color: 'قرمز', imageUrl: '/red.webp' });
  const blue = product({ productId: '5', color: 'آبی', gallery: ['/blue.webp', '/red.webp'] });

  assert.deepEqual(phoneModelImages([blue, red]), ['/red.webp', '/blue.webp']);
});
