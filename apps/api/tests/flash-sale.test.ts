import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_FLASH_SALE_CONFIG, flashSaleFloor, flashSalePrice, flashSaleWindow, parseFlashSaleConfig, type FlashSaleConfig } from '@tamas/shared';
import { matchProductDuplicate, type DuplicateCandidate } from '../src/services/product-duplicates.js';

const sale: FlashSaleConfig = { ...DEFAULT_FLASH_SALE_CONFIG, enabled: true, items: [{ productId: 'P1', salePrice: 700_000 }] };
// Tehran is UTC+03:30: 18:00 Tehran = 14:30 UTC, 22:00 Tehran = 18:30 UTC.
const at = (utc: string) => new Date(`2026-11-14T${utc}:00.000Z`);

test('the sale runs from 18:00 to 22:00 Tehran time', () => {
  assert.equal(flashSaleWindow(sale, at('14:29')).active, false);
  assert.equal(flashSaleWindow(sale, at('14:30')).active, true);
  assert.equal(flashSaleWindow(sale, at('18:29')).active, true);
  assert.equal(flashSaleWindow(sale, at('18:30')).active, false);
  assert.equal(flashSaleWindow(sale, at('10:00')).startsAt.toISOString(), '2026-11-14T14:30:00.000Z');
  // After it ends, the next window is tomorrow's.
  assert.equal(flashSaleWindow(sale, at('19:00')).startsAt.toISOString(), '2026-11-15T14:30:00.000Z');
});

test('listed products get the sale price only inside the window', () => {
  assert.equal(flashSalePrice(sale, 'P1', 1_000_000, at('15:00')), 700_000);
  assert.equal(flashSalePrice(sale, 'P1', 1_000_000, at('12:00')), null);
  assert.equal(flashSalePrice(sale, 'P2', 1_000_000, at('15:00')), null);
  assert.equal(flashSalePrice({ ...sale, enabled: false }, 'P1', 1_000_000, at('15:00')), null);
});

test('the discount never passes 50%, even if the regular price drops later', () => {
  assert.equal(flashSaleFloor(1_000_000), 500_000);
  assert.equal(flashSalePrice(sale, 'P1', 1_200_000, at('15:00')), 700_000);
  assert.equal(flashSalePrice(sale, 'P1', 1_000_000, at('15:00')), 700_000);
  // Regular price raised to 1.6M: the listed 700k would be 56% off, so the 50% floor (800k) applies.
  assert.equal(flashSalePrice(sale, 'P1', 1_600_000, at('15:00')), 800_000);
  // A sale price at or above the regular price is no sale.
  assert.equal(flashSalePrice(sale, 'P1', 700_000, at('15:00')), null);
});

test('a broken saved config falls back to the safe default (off)', () => {
  assert.equal(parseFlashSaleConfig('{bad json').enabled, false);
  assert.equal(parseFlashSaleConfig(JSON.stringify({ ...sale, startHour: 22, endHour: 18 })).enabled, false);
});

const candidate = (id: number, productId: string, sku: string | null, title: string): DuplicateCandidate => ({
  id, productId, sku, title, model: null, color: 'مشکی', colorEn: null, type: 'physical', digikalaLink: null,
});

test('imports match products by SKU / code only, never by name', () => {
  const rows = [candidate(1, '02010100001', '02010100001', 'هدفون مدل X')];
  // Same name, different code: a different product, not a duplicate.
  assert.equal(matchProductDuplicate(rows, { productId: '02010100002', sku: '02010100002', title: 'هدفون مدل X', color: 'مشکی' }, undefined, { codesOnly: true }), null);
  // Renamed on the site, same SKU: still the same product.
  assert.equal(matchProductDuplicate(rows, { productId: '09999999999', sku: '02010100001', title: 'نام سپیدار' }, undefined, { codesOnly: true })?.reason, 'sku');
  // Manual product creation keeps the name check.
  assert.equal(matchProductDuplicate(rows, { productId: '02010100002', sku: null, title: 'هدفون مدل X', color: 'مشکی' })?.reason, 'identity');
});
