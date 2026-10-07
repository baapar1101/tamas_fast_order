import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sendPayamresanSms } from '../src/services/payamresan-sms.js';

const config = {
  apiKey: 'test-api-key',
  sender: '30004040',
  baseUrl: 'https://api.sms-webservice.com/api/V3',
  toPhone: '۰۹۱۲۱۲۳۴۵۶۷',
  text: 'کد تایید: 12345',
};

describe('Payam Resan SMS transport', () => {
  it('posts the secret in JSON and removes the leading zero from the recipient', async () => {
    const fakeFetch = (async (url: URL, init: RequestInit) => {
      assert.equal(url.href, 'https://api.sms-webservice.com/api/V3/SendBulk');
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(String(init.body)), {
        ApiKey: 'test-api-key',
        Text: 'کد تایید: 12345',
        Sender: 30004040,
        Recipients: [{ Destination: 9121234567 }],
      });
      return new Response(JSON.stringify({ Success: true }), { status: 200 });
    }) as typeof fetch;

    assert.deepEqual(await sendPayamresanSms(config, fakeFetch), { ok: true });
  });

  it('does not treat HTTP 200 as success when the provider rejects the message', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ Success: false, ErrorCode: 12 }), { status: 200 })) as typeof fetch;

    assert.deepEqual(await sendPayamresanSms(config, fakeFetch), {
      ok: false,
      error: 'سامانه پیام‌رسان ارسال پیامک را نپذیرفت (کد 12).',
    });
  });

  it('rejects missing credentials before making a network request', async () => {
    const fakeFetch = (async () => {
      assert.fail('fetch should not be called');
    }) as typeof fetch;

    const result = await sendPayamresanSms({ ...config, apiKey: '' }, fakeFetch);
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /کلید API/);
  });
});
