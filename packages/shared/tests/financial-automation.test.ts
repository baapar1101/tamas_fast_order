import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDiscountAmount,
  isHighValueCreditPayment,
  parseCustomerDiscountConfig,
  parsePaymentRoutingConfig,
} from '../src/financial-automation.js';

test('percentage and fixed discounts never exceed subtotal or configured cap', () => {
  assert.equal(calculateDiscountAmount('percent', 20, 1_000_000, 150_000), 150_000);
  assert.equal(calculateDiscountAmount('fixed', 2_000_000, 1_000_000, null), 1_000_000);
  assert.equal(calculateDiscountAmount('free_shipping', 50, 1_000_000, null), 0);
});

test('discount config is parsed defensively', () => {
  const config = parseCustomerDiscountConfig('{"enabled":true,"kind":"percent","value":400,"prefix":"TA MAS!"}');
  assert.equal(config.enabled, true);
  assert.equal(config.value, 100);
  assert.equal(config.prefix, 'TAMAS');
});

test('only high-value credit plans are held for operator instructions', () => {
  const config = parsePaymentRoutingConfig(null);
  assert.equal(isHighValueCreditPayment(50_000_001, 'cheque', config), true);
  assert.equal(isHighValueCreditPayment(50_000_001, 'daily', config), true);
  assert.equal(isHighValueCreditPayment(50_000_000, 'cash', config), false);
  assert.equal(isHighValueCreditPayment(50_000_000, 'cheque', config), false);
});
