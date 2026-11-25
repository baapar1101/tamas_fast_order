import assert from 'node:assert/strict';
import test from 'node:test';
import { BLACK_FRIDAY_RIBBON, parsePaymentTermsConfig } from '@tamas/shared';
import { blackFridayCashSelectionAllowed, quotePaymentTerms } from '../src/services/payment-terms.js';

test('Black Friday product makes a mixed accessory order cash only at checkout', () => {
  const config = parsePaymentTermsConfig(undefined);
  const lines = [
    { categoryId: null, price: 1_000_000, qty: 1, sellType: 'فقط نقدی', ribbon: BLACK_FRIDAY_RIBBON },
    { categoryId: null, price: 2_000_000, qty: 1, sellType: 'نقدی، اعتباری، چکی', ribbon: null },
  ];
  const quote = quotePaymentTerms(lines, config);
  const cash = quote.plans.find((plan) => plan.kind === 'cash');
  assert.equal(quote.enforcedSettlement, true);
  assert.deepEqual(quote.plans.map((plan) => plan.kind), ['cash']);
  assert.ok(cash);
  assert.equal(blackFridayCashSelectionAllowed(lines, quote, undefined, undefined), false);
  assert.equal(blackFridayCashSelectionAllowed(lines, quote, 'credit_weekly', 'credit_weekly'), false);
  assert.equal(blackFridayCashSelectionAllowed(lines, quote, cash.id, 'wallet'), false);
  assert.equal(blackFridayCashSelectionAllowed(lines, quote, cash.id, 'credit_weekly'), false);
  assert.equal(blackFridayCashSelectionAllowed(lines, quote, cash.id, cash.id), true);
});

test('orders without Black Friday keep their existing settlement options', () => {
  const lines = [{ categoryId: null, price: 1_000_000, qty: 1, sellType: null, ribbon: null }];
  const quote = quotePaymentTerms(lines, parsePaymentTermsConfig(undefined));
  assert.ok(quote.plans.some((plan) => plan.kind === 'cheque'));
  assert.equal(blackFridayCashSelectionAllowed(lines, quote, undefined, undefined), true);
});
