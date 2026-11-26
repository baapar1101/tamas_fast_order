import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductIdentity } from './product-identity.js';

describe('normalizeProductIdentity', () => {
  test('normalizes standard english strings (lowercase, removes spaces)', () => {
    assert.strictEqual(normalizeProductIdentity('MacBook Pro'), 'macbookpro');
    assert.strictEqual(normalizeProductIdentity(' IPHONE 13-PRO '), 'iphone13pro');
  });

  test('normalizes arabic/persian specific letters (ك -> ک, ي/ى -> ی)', () => {
    assert.strictEqual(normalizeProductIdentity('كيبورد'), 'کیبورد');
    assert.strictEqual(normalizeProductIdentity('ياس'), 'یاس');
    assert.strictEqual(normalizeProductIdentity('حتى'), 'حتی');
  });

  test('converts persian digits to english digits', () => {
    assert.strictEqual(normalizeProductIdentity('۱۲۳۴۵۶۷۸۹۰'), '1234567890');
    assert.strictEqual(normalizeProductIdentity('آیفون ۱۳'), 'آیفون13');
  });

  test('converts arabic digits to english digits', () => {
    assert.strictEqual(normalizeProductIdentity('١٢٣٤٥٦٧٨٩٠'), '1234567890');
  });

  test('removes zero-width characters and formatting marks', () => {
    assert.strictEqual(normalizeProductIdentity('می‌روم'), 'میروم'); // with ZWNJ
  });

  test('removes punctuation and special characters', () => {
    assert.strictEqual(normalizeProductIdentity('hello, world!'), 'helloworld');
    assert.strictEqual(normalizeProductIdentity('a_b-c.d'), 'abcd');
    assert.strictEqual(normalizeProductIdentity('product @#$ name'), 'productname');
  });

  test('handles null, undefined, and non-string values gracefully', () => {
    assert.strictEqual(normalizeProductIdentity(null), '');
    assert.strictEqual(normalizeProductIdentity(undefined), '');
    assert.strictEqual(normalizeProductIdentity(''), '');
    assert.strictEqual(normalizeProductIdentity(123), '123');
    assert.strictEqual(normalizeProductIdentity({}), 'objectobject');
  });

  test('mixed character sets', () => {
    assert.strictEqual(normalizeProductIdentity('  Galaxy S۲۴ Ultra كاور  '), 'galaxys24ultraکاور');
  });
});
