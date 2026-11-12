import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDiscountAmount } from '@tamas/shared';
import { FIRST_PURCHASE_REWARD, isFirstPaidPurchase } from '../src/services/discounts.js';

test('only the first successful purchase earns the next-order reward', () => {
  assert.equal(isFirstPaidPurchase('unpaid', 'new', 0), false);
  assert.equal(isFirstPaidPurchase('paid', 'cancelled', 1), false);
  assert.equal(isFirstPaidPurchase('paid', 'confirmed', 1), true);
  assert.equal(isFirstPaidPurchase('paid', 'confirmed', 2), false);
});

test('the reward takes one million toman off a qualifying next order', () => {
  assert.equal(FIRST_PURCHASE_REWARD.minOrderAmount, 5_000_000);
  assert.equal(calculateDiscountAmount('fixed', FIRST_PURCHASE_REWARD.amount, 5_000_000, null), 1_000_000);
});
