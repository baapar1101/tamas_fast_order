import assert from 'node:assert/strict';
import test from 'node:test';
import AqayePardakht from '../lib/aqayepardakht.js';

test('payment requests use configured credentials and a bounded timeout without a real transaction', async () => {
  const gateway = AqayePardakht('test-pin');
  const requests = [];
  gateway.client.defaults.adapter = async (config) => {
    requests.push(config);
    return { data: { status: 'success' }, status: 200, statusText: 'OK', headers: {}, config };
  };
  await gateway.Create({ amount: 10000, callback: 'https://example.test/callback' });
  await gateway.Verify({ amount: 10000, transid: 'test-transaction' });
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[0].data).pin, 'test-pin');
  assert.equal(requests[0].timeout, 15000);
});
