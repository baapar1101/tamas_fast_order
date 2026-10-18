import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_HOMEPAGE_FILTERS, parseHomepageFilters } from '../src/storefront/homepageFilters';

test('homepage filters keep the existing storefront defaults before configuration', () => {
  assert.deepEqual(parseHomepageFilters(undefined), DEFAULT_HOMEPAGE_FILTERS);
  assert.equal(DEFAULT_HOMEPAGE_FILTERS.find((filter) => filter.type === 'promotion')?.enabled, false);
  assert.equal(DEFAULT_HOMEPAGE_FILTERS.find((filter) => filter.type === 'basket')?.enabled, false);
});

test('homepage filters preserve labels, order, and disabled state', () => {
  const value = JSON.stringify([
    { id: 'festival', type: 'promotion', label: 'پیشنهاد ویژه', enabled: false },
    { id: 'stock', type: 'in_stock', label: 'آماده ارسال', enabled: true },
  ]);
  assert.deepEqual(parseHomepageFilters(value), [
    { id: 'festival', type: 'promotion', label: 'پیشنهاد ویژه', enabled: false },
    { id: 'stock', type: 'in_stock', label: 'آماده ارسال', enabled: true },
  ]);
});

test('homepage filters ignore invalid entries and fall back on malformed JSON', () => {
  assert.deepEqual(parseHomepageFilters('{'), DEFAULT_HOMEPAGE_FILTERS);
  assert.deepEqual(parseHomepageFilters(JSON.stringify([{ type: 'unknown', label: 'ناشناخته' }])), []);
});
