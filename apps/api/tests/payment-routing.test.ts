import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { PAYMENT_ROUTING_SETTING_KEY, type PaymentPlanQuote } from '@tamas/shared';
import * as dbModule from '../src/db/client.js';
import { getPaymentRoutingConfig, securePaymentPlan } from '../src/services/payment-routing.js';

test('payment-routing service', async (t) => {
  // Let's mock getAllSettings to avoid touching the DB entirely
  // We can do this by mocking cache and db logic inside settings.ts, or just db.select().from(settings)

  // Or even better, mock getSetting. Since settings.ts is an ES module and it exports getSetting,
  // we can use mock.module directly since node v22 supports it for ES modules if configured correctly,
  // but it seems mock.module had an issue earlier (TypeError: mock.module is not a function).
  // Wait, mock.module was added in Node.js 22.3.0, but maybe this environment is missing it.

  // Let's mock db.select() directly.
  const originalSelect = dbModule.db.select;

  t.afterEach(() => {
    (dbModule.db as any).select = originalSelect;
  });

  await t.test('getPaymentRoutingConfig parses empty settings to default config', async () => {
    (dbModule.db as any).select = () => ({
      from: () => ({
        where: async () => [] // Returns no settings
      })
    });

    // Clear cache first
    const { invalidateSettings } = await import('../src/services/settings.js');
    invalidateSettings();

    const config = await getPaymentRoutingConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.thresholdAmount, 50_000_000);
  });

  await t.test('getPaymentRoutingConfig parses existing valid config', async () => {
    (dbModule.db as any).select = () => ({
      from: () => ({
        where: async () => [{
          key: PAYMENT_ROUTING_SETTING_KEY,
          value: JSON.stringify({
            enabled: false,
            thresholdAmount: 100_000_000,
            pendingMessage: 'Custom message'
          })
        }]
      })
    });

    const { invalidateSettings } = await import('../src/services/settings.js');
    invalidateSettings();

    const config = await getPaymentRoutingConfig();
    assert.equal(config.enabled, false);
    assert.equal(config.thresholdAmount, 100_000_000);
    assert.equal(config.pendingMessage, 'Custom message');
  });

  await t.test('securePaymentPlan keeps normal plans unchanged', () => {
    const plan: PaymentPlanQuote = {
      finalAmount: 10_000_000,
      payableAmount: 10_000_000,
      paymentMethodId: 1,
      installments: [],
      instructions: null,
      requiresPaymentInfo: true,
    };
    const config = {
      version: 1 as const,
      enabled: true,
      thresholdAmount: 50_000_000,
      pendingMessage: 'Wait',
      accounts: []
    };

    const result = securePaymentPlan(plan, config);
    assert.equal(result.pending, false);
    assert.deepEqual(result.plan, plan);
  });

  await t.test('securePaymentPlan modifies high-value plans when enabled', () => {
    const plan: PaymentPlanQuote = {
      finalAmount: 60_000_000,
      payableAmount: 60_000_000,
      paymentMethodId: 1,
      installments: [],
      instructions: null,
      requiresPaymentInfo: true,
    };
    const config = {
      version: 1 as const,
      enabled: true,
      thresholdAmount: 50_000_000,
      pendingMessage: 'Wait for instructions',
      accounts: []
    };

    const result = securePaymentPlan(plan, config);
    assert.equal(result.pending, true);
    assert.equal(result.plan.instructions, 'Wait for instructions');
    assert.equal(result.plan.requiresPaymentInfo, false);
    assert.equal(result.plan.finalAmount, 60_000_000); // untouched fields remain
  });
});
