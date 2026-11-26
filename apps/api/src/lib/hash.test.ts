import test from 'node:test';
import assert from 'node:assert';
import { safeEqualHex } from './hash.js';

test('safeEqualHex', async (t) => {
  await t.test('returns true for identical hex strings of equal length', () => {
    assert.strictEqual(safeEqualHex('abcdef', 'abcdef'), true);
  });

  await t.test('returns false for different hex strings of equal length', () => {
    assert.strictEqual(safeEqualHex('abcdef', 'abcdee'), false);
  });

  await t.test('returns false for hex strings of different lengths', () => {
    assert.strictEqual(safeEqualHex('abcde', 'abcdef'), false);
    assert.strictEqual(safeEqualHex('abcdef', 'abcde'), false);
  });

  await t.test('returns false when Buffer lengths differ due to invalid hex characters', () => {
    assert.strictEqual(safeEqualHex('zz', 'aa'), false);
  });

  await t.test('returns true for empty strings', () => {
    assert.strictEqual(safeEqualHex('', ''), true);
  });
});
