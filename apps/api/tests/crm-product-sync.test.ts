import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  crmClient,
  isDuplicateCodeError,
  isTransientCrmError,
  readBulkUpsertResult,
  type CrmConfig,
  type CrmProduct,
} from '../src/lib/crm.js';
import { shouldRetryCrmProductSync } from '../src/services/crm-product-sync.js';

const config: CrmConfig = {
  apiBase: 'https://crm.test',
  apiKey: 'test-key',
  businessId: 7,
  webhookSecret: '',
  syncEnabled: true,
  syncDebounceMs: 0,
};

const product: CrmProduct = {
  productId: '02030500087',
  sku: null,
  title: 'Test product',
  price: 100000,
  discount: 0,
  stock: 3,
  status: 'active',
  updatedAt: new Date(0).toISOString(),
};

type Call = { url: string; method: string; body: any };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function fakeCrm(handler: (call: Call) => unknown): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    return new Response(JSON.stringify(handler(call)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return calls;
}

const upserted = { success: true, data: { results: [{ client_ref: product.productId, status: 'updated', product_id: 228674 }] } };

test('a product with a known CRM id is edited, not created again', async () => {
  const calls = fakeCrm(() => upserted);
  const result = await crmClient.pushProduct(product, config, { retries: 0, remoteId: '228674' });
  assert.equal(result.ok, true);
  assert.equal(result.remoteId, 228674);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/products\/business\/7\/bulk-upsert$/);
  assert.equal(calls[0].body.items[0].product_id, 228674);
  assert.equal(calls[0].body.items[0].payload.code, product.productId);
  assert.equal(calls[0].body.items[0].payload.base_sales_price, 100000);
});

test('a product without a stored id is looked up by code and edited', async () => {
  const calls = fakeCrm((call) => (call.url.endsWith('/search')
    ? { success: true, data: { items: [{ id: 5001, code: product.productId }] } }
    : upserted));
  const result = await crmClient.pushProduct(product, config, { retries: 0 });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((c) => c.url.split('/').pop()), ['search', 'bulk-upsert']);
  assert.deepEqual(calls[0].body.filters, [{ property: 'code', operator: '=', value: product.productId }]);
  assert.equal(calls[1].body.items[0].product_id, 5001);
});

test('a product the CRM does not have is created', async () => {
  const calls = fakeCrm((call) => (call.url.endsWith('/search')
    ? { success: true, data: { items: [] } }
    : { success: true, data: { id: 9001 } }));
  const result = await crmClient.pushProduct(product, config, { retries: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.remoteId, 9001);
  assert.equal(calls[1].method, 'POST');
  assert.match(calls[1].url, /\/products\/business\/7$/);
  assert.equal(calls[1].body.item_type, 'کالا');
});

test('a duplicate-code rejection on create falls back to editing the existing product', async () => {
  let searches = 0;
  const calls = fakeCrm((call) => {
    if (call.url.endsWith('/search')) {
      searches += 1;
      return { success: true, data: { items: searches === 1 ? [] : [{ id: 77, code: product.productId }] } };
    }
    if (call.url.endsWith('/bulk-upsert')) return upserted;
    return { success: false, error: { code: 'DUPLICATE', message: 'کد کالا/خدمت تکراری است' } };
  });
  const result = await crmClient.pushProduct(product, config, { retries: 0 });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((c) => c.url.split('/').pop()), ['search', '7', 'search', 'bulk-upsert']);
  assert.equal(calls[3].body.items[0].product_id, 77);
});

test('a stale stored id is replaced by the id found by code', async () => {
  const calls = fakeCrm((call) => {
    if (call.url.endsWith('/search')) return { success: true, data: { items: [{ id: 88, code: product.productId }] } };
    return call.body.items[0].product_id === 88
      ? upserted
      : { success: true, data: { results: [{ status: 'failed', error: 'کالا یافت نشد' }] } };
  });
  const result = await crmClient.pushProduct(product, config, { retries: 0, remoteId: 12 });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((c) => c.body?.items?.[0]?.product_id ?? 'search'), [12, 'search', 88]);
});

test('bulk upsert replies are only successful when the CRM confirms them', () => {
  assert.equal(readBulkUpsertResult(upserted, 1).ok, true);
  assert.equal(readBulkUpsertResult({ results: [{ status: 'created', id: 3 }] }, 1).remoteId, 3);
  const failed = readBulkUpsertResult({ success: true, data: { results: [{ status: 'failed', error: 'نام الزامی است' }] } }, 1);
  assert.deepEqual([failed.ok, failed.error], [false, 'نام الزامی است']);
  assert.equal(readBulkUpsertResult({ success: true }, 1).ok, false);
  assert.equal(readBulkUpsertResult({ success: false, error: { message: 'x' } }, 1).error, 'x');
});

test('only network failures are retried, and only a few times', () => {
  assert.equal(isDuplicateCodeError('کد کالا/خدمت تکراری است'), true);
  assert.equal(isTransientCrmError('The operation was aborted due to timeout'), true);
  assert.equal(isTransientCrmError('fetch failed'), true);
  assert.equal(isTransientCrmError(`Unexpected token '<', "<html>" is not valid JSON`), true);
  assert.equal(isTransientCrmError('کد کالا/خدمت تکراری است'), false);
  assert.equal(shouldRetryCrmProductSync('fetch failed', 0), true);
  assert.equal(shouldRetryCrmProductSync('fetch failed', 8), false);
  assert.equal(shouldRetryCrmProductSync('کد کالا/خدمت تکراری است', 0), false);
});
