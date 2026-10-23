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

test('cash discount applies only to non-mobile categories and is configurable', () => {
  const config = parsePaymentTermsConfig({
    ...parsePaymentTermsConfig(undefined),
    accessory: {
      ...parsePaymentTermsConfig(undefined).accessory,
      cashDiscountPercent: 12.5,
    },
  });
  const accessoryCash = buildPaymentTermsQuote(1_000_000, ['accessory'], config).plans.find((plan) => plan.kind === 'cash');
  const mobileCash = buildPaymentTermsQuote(1_000_000, ['mobile'], config).plans.find((plan) => plan.kind === 'cash');

  assert.equal(accessoryCash?.discountPercent, 12.5);
  assert.equal(accessoryCash?.finalAmount, 875_000);
  assert.equal(mobileCash?.discountPercent, 0);
  assert.equal(mobileCash?.finalAmount, 1_000_000);
});

test('accessory installment profit is configurable per cheque plan', () => {
  const defaults = parsePaymentTermsConfig(undefined);
  const config = parsePaymentTermsConfig({
    ...defaults,
    accessory: {
      ...defaults.accessory,
      rules: defaults.accessory.rules.map((rule) => rule.id === 'accessory-monthly-4'
        ? { ...rule, discountPercent: 0, installmentProfitPercent: 6 }
        : rule),
    },
  });
  const plan = buildPaymentTermsQuote(1_000_000, ['accessory'], config).plans.find((item) => item.id === 'accessory-monthly-4');

  assert.equal(plan?.serviceFeePercent, 6);
  assert.equal(plan?.finalAmount, 1_060_000);
  assert.equal(repricePaymentPlan(plan!, 2_000_000).finalAmount, 2_120_000);
});

test('rounded cheque totals stay exact for small and uneven invoices', () => {
  const config = parsePaymentTermsConfig(undefined);
  for (const base of [10_000, 40_000, 60_000, 90_000, 123_456, 1_003_333]) {
    const plans = buildPaymentTermsQuote(base, ['accessory'], config).plans.filter((plan) => plan.kind === 'cheque');
    for (const original of plans) {
      for (const plan of [original, repricePaymentPlan(original, base + 10_000)]) {
        const payments = plan.schedule.map((item) => item.amount ?? 0);
        assert.ok(payments.every((amount) => amount >= 0));
        assert.equal((plan.upfrontAmount ?? 0) + payments.reduce((sum, amount) => sum + amount, 0), plan.finalAmount);
        if (payments.length > 0) assert.ok(Math.max(...payments) - Math.min(...payments) <= 10_000);
      }
    }
  }
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
