import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProductDTO } from '@tamas/shared';
import { catalogProductImage, catalogProductStock } from '../src/admin/components/catalogProduct';

test('catalog image uses the product image and falls back to its own gallery', () => {
  assert.equal(catalogProductImage({ imageUrl: '/main.webp', gallery: ['/gallery.webp'] }), '/main.webp');
  assert.equal(catalogProductImage({ imageUrl: null, gallery: ['', '/gallery.webp'] }), '/gallery.webp');
  assert.equal(catalogProductImage({ imageUrl: null, gallery: [] }), '/logo.png');
});

test('catalog availability follows warehouse stock without double counting flat stock', () => {
  const product = (stock: number, kermanStock: number, tehranStock: number) => ({
    stock, kermanStock, tehranStock,
  } as Pick<ProductDTO, 'stock' | 'kermanStock' | 'tehranStock'>);
  assert.equal(catalogProductStock(product(20, 3, 2)), 5);
  assert.equal(catalogProductStock(product(4, 0, 0)), 4);
  assert.equal(catalogProductStock(product(0, 0, 0)), 0);
});
