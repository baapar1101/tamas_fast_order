import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newLandingSection } from '@tamas/shared';
import { featuredQuery, featuredShopHref, hasCatalogParams, shopHref } from '../src/storefront/landing/shopLinks.ts';

test('home links with catalog filters belong to the catalog', () => {
  assert.equal(hasCatalogParams('?brand=Apple'), true);
  assert.equal(hasCatalogParams('?tab=cart'), true);
  assert.equal(hasCatalogParams('?utm_source=sms'), false);
  assert.equal(hasCatalogParams(''), false);
});

test('old banner links are sent to the catalog', () => {
  assert.equal(shopHref('/?brand=Apple'), '/shop?brand=Apple');
  assert.equal(shopHref('/#cart'), '/shop#cart');
  assert.equal(shopHref('/p/1040012345'), '/p/1040012345');
  assert.equal(shopHref('https://example.com/x'), 'https://example.com/x');
});

test('featured sections query and link the same products', () => {
  const section = newLandingSection('featured', 'f');
  if (section.type !== 'featured') throw new Error('type');
  assert.equal(featuredQuery(section).promotion, true);
  assert.equal(featuredShopHref(section), '/shop?promo=1');
  const byBrand = { ...section, source: 'brand' as const, value: 'Samsung' };
  assert.deepEqual(featuredQuery(byBrand).brands, ['Samsung']);
  assert.equal(featuredShopHref(byBrand), '/shop?brand=Samsung');
  const newest = { ...section, source: 'newest' as const };
  assert.equal(featuredShopHref(newest), '/shop?sort=newest');
});
