import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBundleContents } from '../src/services/bundle-contents.js';

test('bundle contents preserve every item, quantity and order without component prices', () => {
  const result = resolveBundleContents(
    [{ productId: '01001', qty: 2 }, { productId: '01002', qty: 1 }, { productId: '01003', qty: 4 }],
    [{ productId: '01002', title: 'کابل' }, { productId: '01001', title: 'شارژر' }],
  );
  assert.deepEqual(result, [
    { productId: '01001', qty: 2, title: 'شارژر' },
    { productId: '01002', qty: 1, title: 'کابل' },
    { productId: '01003', qty: 4, title: 'کالا با کد 01003' },
  ]);
  assert.equal(result.some((item) => 'price' in item), false);
});
