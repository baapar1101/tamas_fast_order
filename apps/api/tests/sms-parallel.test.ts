import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { settleParallelSmsAttempts } from '../src/services/sms.js';

describe('parallel OTP resend delivery', () => {
  it('starts every configured provider before waiting for a response', async () => {
    const started: string[] = [];
    let finishPrimary!: () => void;
    let finishFallback!: () => void;
    const primary = new Promise<void>((resolve) => { finishPrimary = resolve; });
    const fallback = new Promise<void>((resolve) => { finishFallback = resolve; });

    const pending = settleParallelSmsAttempts([
      {
        label: 'primary',
        send: async () => {
          started.push('primary');
          await primary;
          return { ok: false, error: 'rejected', fallbackSafe: true };
        },
      },
      {
        label: 'fallback',
        send: async () => {
          started.push('fallback');
          await fallback;
          return { ok: true };
        },
      },
    ]);

    assert.deepEqual(started, ['primary', 'fallback']);
    finishPrimary();
    finishFallback();
    assert.deepEqual(await pending, { ok: true });
  });

  it('reports every provider error only when all parallel attempts fail', async () => {
    const result = await settleParallelSmsAttempts([
      { label: 'primary', send: async () => ({ ok: false, error: 'first failed' }) },
      { label: 'fallback', send: async () => ({ ok: false, error: 'second failed' }) },
    ]);
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /primary: first failed/);
    assert.match(result.error ?? '', /fallback: second failed/);
  });
});
