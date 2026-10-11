import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sendMelipayamakPatternSms, sendMelipayamakSms } from '../src/services/melipayamak-sms.js';

const config = {
  username: 'test-user',
  apiKey: 'test-api-key',
  sender: '5000123456',
  baseUrl: 'https://rest.payamak-panel.com/api/SendSMS',
  toPhone: '۰۹۱۲۱۲۳۴۵۶۷',
  text: 'پیام آزمایشی',
};

describe('Meli Payamak SMS transport', () => {
  it('sends OTP through the approved BaseServiceNumber template contract', async () => {
    const fakeFetch = (async (url: URL, init: RequestInit) => {
      assert.equal(url.href, 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber');
      assert.equal(init.method, 'POST');
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get('username'), 'test-user');
      assert.equal(body.get('password'), 'test-api-key');
      assert.equal(body.get('text'), '12345');
      assert.equal(body.get('to'), '09121234567');
      assert.equal(body.get('bodyId'), '556182');
      assert.equal(body.has('from'), false);
      return new Response(JSON.stringify({
        Value: '4973768981299226116',
        RetStatus: 1,
        StrRetStatus: 'Ok',
      }), { status: 200 });
    }) as typeof fetch;

    assert.deepEqual(await sendMelipayamakPatternSms({
      username: 'test-user',
      apiKey: 'test-api-key',
      patternBaseUrl: 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber',
      toPhone: '۰۹۱۲۱۲۳۴۵۶۷',
      bodyId: '556182',
      values: ['12345'],
    }, fakeFetch), { ok: true });
  });

  it('rejects an invalid template id without contacting the provider', async () => {
    const fakeFetch = (async () => {
      assert.fail('fetch should not be called');
    }) as typeof fetch;
    const result = await sendMelipayamakPatternSms({
      username: 'test-user',
      apiKey: 'test-api-key',
      patternBaseUrl: 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber',
      toPhone: '09121234567',
      bodyId: 'otp-template',
      values: ['12345'],
    }, fakeFetch);
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /کد الگو/);
  });

  it('uses the API key as password and follows the official REST contract', async () => {
    const fakeFetch = (async (url: URL, init: RequestInit) => {
      assert.equal(url.href, 'https://rest.payamak-panel.com/api/SendSMS/SendSMS');
      assert.equal(init.method, 'POST');
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get('username'), 'test-user');
      assert.equal(body.get('password'), 'test-api-key');
      assert.equal(body.get('to'), '09121234567');
      assert.equal(body.get('from'), '5000123456');
      assert.equal(body.get('text'), 'پیام آزمایشی');
      assert.equal(body.get('isFlash'), 'false');
      return new Response(JSON.stringify({
        Value: '4973768981299226115',
        RetStatus: 1,
        StrRetStatus: 'Ok',
      }), { status: 200 });
    }) as typeof fetch;

    assert.deepEqual(await sendMelipayamakSms(config, fakeFetch), { ok: true });
  });

  it('treats a non-positive provider code as a definitive rejection', async () => {
    const fakeFetch = (async () => new Response('-7', { status: 200 })) as typeof fetch;
    assert.deepEqual(await sendMelipayamakSms(config, fakeFetch), {
      ok: false,
      error: 'ملی‌پیامک ارسال را نپذیرفت (پاسخ -7).',
      fallbackSafe: true,
    });
  });

  it('returns the provider status without exposing credentials', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({
      Value: null,
      RetStatus: 0,
      StrRetStatus: 'Authentication failed',
    }), { status: 200 })) as typeof fetch;
    assert.deepEqual(await sendMelipayamakSms(config, fakeFetch), {
      ok: false,
      error: 'ملی‌پیامک ارسال را نپذیرفت (پاسخ وضعیت 0: Authentication failed).',
      fallbackSafe: true,
    });
  });

  it('does not permit fallback after an ambiguous transport error', async () => {
    const fakeFetch = (async () => { throw new Error('timeout'); }) as typeof fetch;
    assert.deepEqual(await sendMelipayamakSms(config, fakeFetch), {
      ok: false,
      error: 'ارتباط با وب‌سرویس ملی‌پیامک برقرار نشد.',
      fallbackSafe: false,
    });
  });
});
