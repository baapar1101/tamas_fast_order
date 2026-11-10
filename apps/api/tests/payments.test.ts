import { describe, it } from 'node:test';
import assert from 'node:assert';
import { paymentTxStatus, type OrderPaymentStatus } from '../src/services/payments.js';

describe('payments', () => {
  describe('paymentTxStatus', () => {
    it('maps paid status to success', () => {
      assert.strictEqual(paymentTxStatus('paid'), 'success');
    });

    it('maps unpaid status to pending', () => {
      assert.strictEqual(paymentTxStatus('unpaid'), 'pending');
    });

    it('maps pending status to pending', () => {
      assert.strictEqual(paymentTxStatus('pending'), 'pending');
    });
  });
});
