import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPaymentTermsQuote,
  buildRestrictedPaymentTermsQuote,
  parsePaymentTermsConfig,
  paymentAudienceForCategory,
  repricePaymentPlan,
  settlementPolicyFromSellType,
} from '../src/payment-terms.js';

test('default config reproduces accessory cash discount and cheque prepayment', () => {
  const config = parsePaymentTermsConfig(undefined);
  const quote = buildPaymentTermsQuote(1_000_000, ['accessory'], config);
  const cash = quote.plans.find((plan) => plan.id === 'accessory-monthly-0');
  const fourMonth = quote.plans.find((plan) => plan.id === 'accessory-monthly-4');
  assert.equal(cash?.finalAmount, 900_000);
  assert.equal(cash?.discountPercent, 10);
  assert.equal(fourMonth?.upfrontAmount, 300_000);
  assert.equal(fourMonth?.termMonths, 4);
  assert.equal(fourMonth?.installmentIntervalMonths, 1);
  assert.equal(fourMonth?.schedule.length, 4);
  assert.equal(fourMonth?.schedule.reduce((sum, item) => sum + (item.amount ?? 0), 0), 700_000);
  assert.ok(fourMonth?.schedule.every((item) => item.amount != null && item.amount % 10_000 === 0));
  const rounded = buildPaymentTermsQuote(1_003_333, ['accessory'], config).plans.find((plan) => plan.id === 'accessory-monthly-4');
  assert.equal(rounded?.finalAmount, 1_000_000);
  assert.equal(rounded?.upfrontAmount, 300_000);
  assert.ok(rounded?.schedule.every((item) => item.amount != null && item.amount % 10_000 === 0));
  const oneMonth = quote.plans.find((plan) => plan.id === 'accessory-monthly-1');
  assert.equal(repricePaymentPlan(oneMonth!, 2_000_000).finalAmount, 1_900_000);
});

test('default config reproduces mobile service fees and daily schedule', () => {
  const config = parsePaymentTermsConfig(undefined);
  assert.equal(paymentAudienceForCategory(2, config), 'mobile');
  const quote = buildPaymentTermsQuote(10_000_000, ['mobile'], config);
  const fiveDays = quote.plans.find((plan) => plan.id === 'mobile-5-days');
  assert.equal(fiveDays?.finalAmount, 10_130_000);
  assert.equal(fiveDays?.settlementDays, 5);
  assert.deepEqual(fiveDays?.schedule.map((item) => item.percent), [null, 20, 20, 20, 20]);
  assert.equal(repricePaymentPlan(fiveDays!, 20_000_000).finalAmount, 20_260_000);
});

test('mixed mobile and accessory cart does not expose an ambiguous plan', () => {
  const quote = buildPaymentTermsQuote(2_000_000, ['mobile', 'accessory'], parsePaymentTermsConfig(undefined));
  assert.equal(quote.audience, 'mixed');
  assert.equal(quote.plans.length, 0);
  assert.match(quote.message ?? '', /دو سفارش جدا/);
});

test('product sell type is converted to a strict settlement policy', () => {
  assert.equal(settlementPolicyFromSellType('فقط نقدی'), 'cash_only');
  assert.equal(settlementPolicyFromSellType('چک فقط ۲ ماهه'), 'cheque_2');
  assert.equal(settlementPolicyFromSellType('چک فقط دو ماهه'), 'cheque_2');
  assert.equal(settlementPolicyFromSellType('نقدی، اعتباری، چکی'), 'unrestricted');
  assert.equal(settlementPolicyFromSellType(null), 'unrestricted');
});

test('cash-only products expose no non-cash settlement plans', () => {
  const quote = buildRestrictedPaymentTermsQuote([
    { amount: 1_000_000, audience: 'accessory', sellType: 'فقط نقدی' },
  ], parsePaymentTermsConfig(undefined));
  assert.equal(quote.enforcedSettlement, true);
  assert.equal(quote.settlementPolicy, 'cash_only');
  assert.deepEqual(quote.plans.map((plan) => plan.kind), ['cash']);
  assert.equal(quote.plans[0]?.finalAmount, 900_000);
});

test('mixed settlement policies merge every month-two amount into one cheque', () => {
  const config = parsePaymentTermsConfig(undefined);
  const quote = buildRestrictedPaymentTermsQuote([
    { amount: 1_000_000, audience: 'accessory', sellType: 'فقط نقدی' },
    { amount: 1_000_000, audience: 'accessory', sellType: 'چک فقط ۲ ماهه' },
    { amount: 1_000_000, audience: 'accessory', sellType: 'بدون محدودیت تا ۶ ماه' },
  ], config);
  const plan = quote.plans[0]!;
  assert.equal(quote.enforcedSettlement, true);
  assert.equal(quote.settlementPolicy, 'combined');
  assert.equal(plan.finalAmount, 2_900_000);
  assert.equal(plan.upfrontAmount, 1_600_000);
  assert.deepEqual(plan.schedule.map((item) => item.dueLabel), ['ماه 2', 'ماه 4', 'ماه 6']);
  assert.equal(plan.schedule[0]?.amount, 970_000);
  assert.equal(plan.schedule.reduce((sum, item) => sum + (item.amount ?? 0), 0), 1_300_000);
  assert.equal(plan.schedule.length, 3);

  const repriced = repricePaymentPlan(plan, 2_700_000);
  assert.equal(repriced.finalAmount, 2_610_000);
  assert.equal(repriced.upfrontAmount, 1_440_000);
  assert.equal(repriced.schedule[0]?.amount, 870_000);
  assert.equal((repriced.upfrontAmount ?? 0) + repriced.schedule.reduce((sum, item) => sum + (item.amount ?? 0), 0), repriced.finalAmount);
});
