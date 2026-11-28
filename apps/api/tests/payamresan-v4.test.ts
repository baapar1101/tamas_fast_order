import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PayamResanError,
  SmsService,
  parseIranLocalTime,
  toProviderMobile,
  type InboxMessage,
} from '../src/services/payamresan-v4.js';
import { createInboxPoller, inboxServiceFromConfig } from '../src/services/sms-inbox.js';

const KEY = 'unit-test-key-not-real';
type Call = { url: string; init: RequestInit };

function mockFetch(reply: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    return reply(call);
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function rejected(promise: Promise<unknown>): Promise<PayamResanError> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof PayamResanError, `expected PayamResanError, got ${String(err)}`);
    return err;
  }
  assert.fail('expected the call to fail');
}

describe('Payam Resan v4 SmsService', () => {
  it('posts GetInbox as JSON with ApiKey in the body only and maps the docs sample', async () => {
    const { impl, calls } = mockFetch(() => json({
      success: true,
      errorCode: null,
      error: null,
      result: [{ id: '1850000000000000001', text: 'سلام', from: 9123456789, to: 3000505, time: '2026-10-01 10:00:00' }],
    }));
    const messages = await new SmsService(KEY, { fetch: impl }).getInbox();

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, 'https://www.payam-resan.com/uapi/v4/GetInbox');
    assert.equal(calls[0]!.init.method, 'POST');
    assert.equal((calls[0]!.init.headers as Record<string, string>)['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { ApiKey: KEY });
    assert.ok(!calls[0]!.url.includes(KEY));

    assert.deepEqual(messages, [{
      id: '1850000000000000001',
      text: 'سلام',
      from: '9123456789',
      fromMobile: '9123456789',
      to: '3000505',
      time: '2026-10-01 10:00:00',
      receivedAt: new Date('2026-10-01T06:30:00.000Z'),
    }]);
  });

  it('keeps an id string intact even past the safe-integer range', async () => {
    const { impl } = mockFetch(() => new Response(
      '{"success":true,"errorCode":null,"error":null,"result":[{"id":"1850000000000000123","text":"x","from":"09121234567","to":"3000505","time":"bad"}]}',
      { status: 200 },
    ));
    const [message] = await new SmsService(KEY, { fetch: impl }).getInbox();
    assert.equal(message!.id, '1850000000000000123');
    assert.equal(message!.fromMobile, '9121234567');
    assert.equal(message!.receivedAt, null);
  });

  it('treats an empty or null result as no messages', async () => {
    for (const result of [[], null]) {
      const { impl } = mockFetch(() => json({ success: true, result, errorCode: null, error: null }));
      assert.deepEqual(await new SmsService(KEY, { fetch: impl }).getInbox(), []);
    }
  });

  it('checks success even on HTTP 200 and surfaces errorCode/error', async () => {
    const { impl } = mockFetch(() => json({ success: false, result: null, errorCode: 4, error: 'ApiKey is invalid' }));
    const err = await rejected(new SmsService(KEY, { fetch: impl }).getInbox());
    assert.equal(err.kind, 'provider');
    assert.equal(err.providerErrorCode, 4);
    assert.equal(err.statusCode, 502);
    assert.equal(err.code, 'sms_provider_error');
    assert.match(err.message, /کد 4/);
    assert.match(err.message, /ApiKey is invalid/);
    assert.ok(!err.message.includes(KEY));
  });

  it('reports unexpected HTTP statuses and unreadable bodies', async () => {
    const http = await rejected(new SmsService(KEY, { fetch: mockFetch(() => new Response('<html>', { status: 503 })).impl }).getInbox());
    assert.equal(http.kind, 'http');
    assert.equal(http.httpStatus, 503);

    const invalid = await rejected(new SmsService(KEY, { fetch: mockFetch(() => new Response('not json', { status: 200 })).impl }).getInbox());
    assert.equal(invalid.kind, 'invalid_response');

    const shape = await rejected(new SmsService(KEY, { fetch: mockFetch(() => json({ success: true, result: { id: 1 }, errorCode: null, error: null })).impl }).getInbox());
    assert.equal(shape.kind, 'invalid_response');
  });

  it('maps network failures and timeouts without leaking the request', async () => {
    const network = await rejected(new SmsService(KEY, {
      fetch: mockFetch(() => { throw new TypeError(`fetch failed ${KEY}`); }).impl,
    }).getInbox());
    assert.equal(network.kind, 'network');
    assert.ok(!network.message.includes(KEY));

    const hanging = (async (_url: string | URL, init: RequestInit = {}) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as typeof fetch;
    const timeout = await rejected(new SmsService(KEY, { fetch: hanging, timeoutMs: 20 }).getInbox());
    assert.equal(timeout.kind, 'timeout');
    assert.equal(timeout.statusCode, 504);
  });

  it('refuses to call the provider without a key', async () => {
    const { impl, calls } = mockFetch(() => json({}));
    const service = new SmsService('  ', { fetch: impl });
    assert.equal(service.configured, false);
    const err = await rejected(service.getInbox());
    assert.equal(err.kind, 'not_configured');
    assert.equal(calls.length, 0);
  });

  it('reads GetAccountInfo and keeps senders as strings', async () => {
    const { impl, calls } = mockFetch(() => json({ success: true, result: { credit: 500000, availableSenders: [3000505] }, errorCode: null, error: null }));
    assert.deepEqual(await new SmsService(KEY, { fetch: impl }).getAccountInfo(), { credit: 500000, availableSenders: ['3000505'] });
    assert.equal(calls[0]!.url, 'https://www.payam-resan.com/uapi/v4/GetAccountInfo');
    assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { ApiKey: KEY });
  });

  it('rejects a non-https base URL', () => {
    assert.throws(() => new SmsService(KEY, { baseUrl: 'http://www.payam-resan.com/uapi/v4' }));
  });
});

describe('Payam Resan helpers', () => {
  it('normalises mobiles to the 9xxxxxxxxx form', () => {
    for (const input of ['09123456789', '9123456789', '+989123456789', '00989123456789', '۰۹۱۲۳۴۵۶۷۸۹', 9123456789]) {
      assert.equal(toProviderMobile(input), '9123456789');
    }
    assert.equal(toProviderMobile('3000505'), null);
    assert.equal(toProviderMobile('02112345678'), null);
  });

  it('reads Iran local time as +03:30', () => {
    assert.equal(parseIranLocalTime('2026-10-01 10:00:00')?.toISOString(), '2026-10-01T06:30:00.000Z');
    assert.equal(parseIranLocalTime('1405-07-09 10:00:00'), null);
    assert.equal(parseIranLocalTime(''), null);
  });

  it('uses the v4 host for the inbox unless a v4 URL is configured', () => {
    const seen: string[] = [];
    const impl = (async (url: string | URL) => {
      seen.push(String(url));
      return json({ success: true, result: [], errorCode: null, error: null });
    }) as typeof fetch;
    return Promise.all([
      inboxServiceFromConfig({ apiKey: KEY, sender: '', baseUrl: 'https://api.sms-webservice.com/api/V3' }, impl).getInbox(),
      inboxServiceFromConfig({ apiKey: KEY, sender: '', baseUrl: 'https://example.payam-resan.com/uapi/v4/' }, impl).getInbox(),
    ]).then(() => assert.deepEqual(seen, [
      'https://www.payam-resan.com/uapi/v4/GetInbox',
      'https://example.payam-resan.com/uapi/v4/GetInbox',
    ]));
  });
});

describe('incoming SMS poller', () => {
  const message = (id: string): InboxMessage => ({
    id, text: 'سلام', from: '9123456789', fromMobile: '9123456789', to: '3000505', time: '2026-10-01 10:00:00', receivedAt: null,
  });

  function serviceReturning(batches: InboxMessage[][]) {
    let calls = 0;
    const service = { configured: true, getInbox: async () => { calls += 1; return batches.shift() ?? []; } } as unknown as SmsService;
    return { service: async () => service, calls: () => calls };
  }

  it('keeps a fetched batch when the database fails and saves it before asking the provider again', async () => {
    const provider = serviceReturning([[message('1'), message('2')], [message('3')]]);
    const saved: string[] = [];
    let dbDown = true;
    const poll = createInboxPoller({
      service: provider.service,
      store: async (messages) => {
        if (dbDown) throw new Error('db down');
        saved.push(...messages.map((m) => m.id));
        return messages.length;
      },
    });

    await assert.rejects(poll(), /db down/);
    assert.equal(provider.calls(), 1);

    // Still down: the buffered batch fails again and the provider is not asked for more.
    await assert.rejects(poll(), /db down/);
    assert.equal(provider.calls(), 1);

    dbDown = false;
    assert.deepEqual(await poll(), { fetched: 1, stored: 3, pending: 0 });
    assert.deepEqual(saved, ['1', '2', '3']);
    assert.equal(provider.calls(), 2);
  });

  it('skips quietly when no key is configured', async () => {
    const service = { configured: false, getInbox: async () => assert.fail('must not call the provider') } as unknown as SmsService;
    const poll = createInboxPoller({ service: async () => service, store: async () => 0 });
    assert.deepEqual(await poll(), { skipped: 'not_configured', fetched: 0, stored: 0, pending: 0 });
  });

  it('does not run two polls at once', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const service = { configured: true, getInbox: async () => { await gate; return [message('9')]; } } as unknown as SmsService;
    const poll = createInboxPoller({ service: async () => service, store: async (m) => m.length });
    const first = poll();
    assert.equal((await poll()).skipped, 'running');
    release();
    assert.deepEqual(await first, { fetched: 1, stored: 1, pending: 0 });
  });
});
