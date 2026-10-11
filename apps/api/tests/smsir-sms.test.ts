import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sendSmsIrBulk, sendSmsIrVerify } from '../src/services/smsir-sms.js';

const base = {
  apiKey: 'test-api-key',
  baseUrl: 'https://api.sms.ir',
  toPhone: '۰۹۱۲۱۲۳۴۵۶۷',
};

describe('SMS.ir transport', () => {
  it('sends arbitrary messages using the official bulk contract', async () => {
    const fakeFetch = (async (url: URL, init: RequestInit) => {
      assert.equal(url.href, 'https://api.sms.ir/v1/send/bulk');
      assert.equal(new Headers(init.headers).get('x-api-key'), 'test-api-key');
      assert.deepEqual(JSON.parse(String(init.body)), {
        lineNumber: 30007732000000,
        messageText: 'پیام آزمایشی',
        mobiles: ['09121234567'],
      });
      return new Response(JSON.stringify({
        status: 1,
        message: 'موفق',
        data: { packId: '123', messageIds: [456], cost: 100 },
      }), { status: 200 });
    }) as typeof fetch;

    assert.deepEqual(await sendSmsIrBulk({
      ...base,
      lineNumber: '30007732000000',
      text: 'پیام آزمایشی',
    }, fakeFetch), { ok: true });
  });

  it('supports the verify-template contract supplied by SMS.ir', async () => {
    const fakeFetch = (async (url: URL, init: RequestInit) => {
      assert.equal(url.href, 'https://api.sms.ir/v1/send/verify');
      assert.deepEqual(JSON.parse(String(init.body)), {
        mobile: '09121234567',
        templateId: 576401,
        parameters: [{ name: 'PARAMETER1', value: '12345' }],
      });
      return new Response(JSON.stringify({
        status: 1,
        message: 'موفق',
        data: { messageId: 987, cost: 100 },
      }), { status: 200 });
    }) as typeof fetch;

    assert.deepEqual(await sendSmsIrVerify({
      ...base,
      templateId: '576401',
      parameters: [{ name: 'PARAMETER1', value: '12345' }],
    }, fakeFetch), { ok: true });
  });

  it('marks a provider rejection safe for the next fallback', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({
      status: 0,
      message: 'اعتبار کافی نیست',
      data: null,
    }), { status: 200 })) as typeof fetch;
    assert.deepEqual(await sendSmsIrBulk({
      ...base,
      lineNumber: '30007732000000',
      text: 'پیام آزمایشی',
    }, fakeFetch), {
      ok: false,
      error: 'سامانه sms.ir ارسال را نپذیرفت (وضعیت 0: اعتبار کافی نیست).',
      fallbackSafe: true,
    });
  });

  it('does not permit another fallback after an ambiguous timeout', async () => {
    const fakeFetch = (async () => { throw new Error('timeout'); }) as typeof fetch;
    assert.deepEqual(await sendSmsIrBulk({
      ...base,
      lineNumber: '30007732000000',
      text: 'پیام آزمایشی',
    }, fakeFetch), {
      ok: false,
      error: 'ارتباط با وب‌سرویس sms.ir برقرار نشد.',
      fallbackSafe: false,
    });
  });
});
