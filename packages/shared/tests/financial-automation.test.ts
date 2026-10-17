import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDiscountAmount,
  parseCustomerDiscountConfig,
  parsePaymentRoutingConfig,
  requiresManualPaymentInstructions,
  selectPaymentAccount,
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

test('every payment above the routing threshold is held for operator instructions', () => {
  const config = parsePaymentRoutingConfig(null);
  assert.equal(requiresManualPaymentInstructions(50_000_001, config), true);
  assert.equal(requiresManualPaymentInstructions(50_000_000, config), false);
  assert.equal(requiresManualPaymentInstructions(49_999_999, config), false);
  assert.equal(requiresManualPaymentInstructions(100_000_000, { ...config, enabled: false }), false);
});

test('legacy credit-only pending message is upgraded to the general high-value message', () => {
  const config = parsePaymentRoutingConfig(JSON.stringify({
    pendingMessage: 'مبلغ این فاکتور اعتباری بیش از ۵۰ میلیون تومان است. اطلاعات پرداخت به‌زودی از طریق پیامک، تلگرام یا بله برای شما ارسال خواهد شد.',
  }));
  assert.match(config.pendingMessage, /مبلغ این سفارش/);
});

test('smart account routing uses only enabled accounts within the configured amount range', () => {
  const config = parsePaymentRoutingConfig({
    version: 1,
    enabled: true,
    thresholdAmount: 50_000_000,
    pendingMessage: 'منتظر بمانید',
    accounts: [
      { id: 'small', label: 'کوچک', bankName: '', holder: '', cardNumber: '1', iban: '', accountNumber: '', enabled: true, minAmount: 0, maxAmount: 60_000_000 },
      { id: 'large', label: 'بزرگ', bankName: '', holder: '', cardNumber: '2', iban: '', accountNumber: '', enabled: true, minAmount: 60_000_001, maxAmount: null },
      { id: 'disabled', label: 'غیرفعال', bankName: '', holder: '', cardNumber: '3', iban: '', accountNumber: '', enabled: false, minAmount: 0, maxAmount: null },
    ],
  });
  assert.equal(selectPaymentAccount(7, 55_000_000, config)?.id, 'small');
  assert.equal(selectPaymentAccount(7, 80_000_000, config)?.id, 'large');
  assert.equal(selectPaymentAccount(7, 50_000_000, config), null);
});
