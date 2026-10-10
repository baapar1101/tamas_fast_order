import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toZohalBirthDate, unwrapZohalEnvelope, ZohalClient, ZohalError } from '../src/services/zohal.js';

describe('Zohal integration', () => {
  it('uses the slash-separated Jalali birth date required by Zohal', () => {
    assert.equal(toZohalBirthDate('1377-09-03'), '1377/09/03');
  });

  it('reads the direct OpenAPI response envelope', () => {
    const payload = {
      result: 1,
      response_body: { data: { matched: true }, error_code: null, message: 'موفق' },
    };
    assert.deepEqual(unwrapZohalEnvelope<{ matched: boolean }>(payload)?.response_body.data, { matched: true });
  });

  it('keeps compatibility with the older gateway wrapper', () => {
    const payload = [{
      data: {
        result: {
          result: 1,
          response_body: { data: { count: 2 }, error_code: null, message: 'موفق' },
        },
      },
    }];
    assert.equal(unwrapZohalEnvelope<{ count: number }>(payload)?.response_body.data.count, 2);
  });

  it('sends documented identity fields and bearer authentication', async () => {
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(String(url), 'https://service.zohal.io/api/v0/services/inquiry/national_identity_inquiry');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer secret-token');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        national_code: '0012345678',
        birth_date: '1377/09/03',
      });
      return new Response(JSON.stringify({
        result: 1,
        response_body: {
          data: { matched: true, alive: true, is_dead: false },
          error_code: null,
          message: 'موفق',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const client = new ZohalClient({ token: 'secret-token', fetchImpl: fakeFetch });
    const result = await client.inquiryIdentity('0012345678', '1377-09-03');
    assert.equal(result.matched, true);
  });

  it('rejects provider errors even when a JSON response is returned', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({
      result: 6,
      response_body: { data: {}, error_code: 'invalid', message: 'Invalid Jalali date.' },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    const client = new ZohalClient({ token: 'secret-token', fetchImpl: fakeFetch });

    await assert.rejects(
      () => client.inquiryIdentity('0012345678', '1377-09-03'),
      (error: unknown) => error instanceof ZohalError && error.providerCode === 'invalid',
    );
  });
});
