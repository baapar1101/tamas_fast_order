import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildChequeOrderDTO } from '../src/services/credit-cheques-count.js';
import type { PaymentPlanQuote } from '@tamas/shared';

describe('Credit Routes: Cheque Registration Optimization', () => {
  it('correctly uses the registeredCount to build cheque order DTOs', async () => {
    const paymentPlan: PaymentPlanQuote = {
      kind: 'cheque',
      schedule: [
        { amount: 100 },
        { amount: 200 },
        { amount: 300 }
      ],
      termMonths: 3,
      installmentIntervalMonths: 1,
    };

    const order = {
      id: 1,
      orderCode: 'ORD-123',
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      paymentPlan,
      status: 'active',
    };

    const result0 = buildChequeOrderDTO(order, 0);
    assert.strictEqual(result0?.schedule[0]?.registered, false);
    assert.strictEqual(result0?.schedule[1]?.registered, false);
    assert.strictEqual(result0?.schedule[2]?.registered, false);
    assert.strictEqual(result0?.nextInstallment?.index, 0);

    const result2 = buildChequeOrderDTO(order, 2);
    assert.strictEqual(result2?.schedule[0]?.registered, true);
    assert.strictEqual(result2?.schedule[1]?.registered, true);
    assert.strictEqual(result2?.schedule[2]?.registered, false);
    assert.strictEqual(result2?.nextInstallment?.index, 2);

    const result3 = buildChequeOrderDTO(order, 3);
    assert.strictEqual(result3?.schedule[0]?.registered, true);
    assert.strictEqual(result3?.schedule[1]?.registered, true);
    assert.strictEqual(result3?.schedule[2]?.registered, true);
    assert.strictEqual(result3?.nextInstallment, null);
  });
});
