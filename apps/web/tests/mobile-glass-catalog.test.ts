import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductDTO } from '@tamas/shared';
import { groupMobilePhoneProducts, isMobilePhoneProduct } from '../src/admin/components/mobileGlassCatalogData';

function product(overrides: Partial<ProductDTO>): ProductDTO {
  return {
    id: 1,
    productId: 'p-1',
    title: 'Galaxy A55',
    model: 'A55',
    type: 'physical',
    categoryName: 'Mobile Phones',
    categoryFaName: 'گوشی موبایل',
    brandName: 'Samsung',
    brandFaName: 'سامسونگ',
    color: 'مشکی',
    colorEn: 'Black',
    price: 1,
    ...overrides,
  } as ProductDTO;
}

test('mobile glass catalog keeps phones and rejects mobile accessories and bundles', () => {
  assert.equal(isMobilePhoneProduct(product({})), true);
  assert.equal(isMobilePhoneProduct(product({ categoryName: 'Mobile Accessories', categoryFaName: 'لوازم جانبی موبایل' })), false);
  assert.equal(isMobilePhoneProduct(product({ type: 'bundle' })), false);
  assert.equal(isMobilePhoneProduct(product({ categoryName: null, categoryFaName: null, title: 'Apple iPhone 17 Pro' })), true);
});

test('mobile products are grouped into the reference brand order and sorted by model', () => {
  const groups = groupMobilePhoneProducts([
    product({ id: 3, brandName: 'Apple', brandFaName: 'اپل', title: 'iPhone 17', model: '17' }),
    product({ id: 2, brandName: 'Xiaomi', brandFaName: 'شیائومی', title: 'Redmi Note 15', model: 'Note 15' }),
    product({ id: 1, title: 'Galaxy S26', model: 'S26' }),
  ]);
  assert.deepEqual(groups.map((group) => group.label), ['SAMSUNG', 'XIAOMI', 'iPhone']);
  assert.deepEqual(groups.map((group) => group.products.length), [1, 1, 1]);
});

