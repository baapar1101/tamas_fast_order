import { describe, it } from 'node:test';
import assert from 'node:assert';
import { productSourceId } from './product-identity';

describe('productSourceId', () => {
  it('returns empty string for falsy values', () => {
    assert.strictEqual(productSourceId(undefined), '');
    assert.strictEqual(productSourceId(null), '');
    assert.strictEqual(productSourceId(''), '');
    assert.strictEqual(productSourceId('   '), '');
  });

  it('extracts ID from dkp- prefix', () => {
    assert.strictEqual(productSourceId('dkp-12345'), '12345');
    assert.strictEqual(productSourceId('DKP-67890'), '67890');
    assert.strictEqual(productSourceId('dkp-1'), '1');
  });

  it('extracts ID from /product/ format', () => {
    assert.strictEqual(productSourceId('https://example.com/product/12345/name'), '12345');
    assert.strictEqual(productSourceId('/product/67890'), '67890');
    assert.strictEqual(productSourceId('/product/1'), '1');
  });

  it('extracts ID from /products/ format', () => {
    assert.strictEqual(productSourceId('https://example.com/products/12345/name'), '12345');
    assert.strictEqual(productSourceId('/products/67890'), '67890');
    assert.strictEqual(productSourceId('/products/1'), '1');
  });

  it('falls back to normalized string when no regex match', () => {
    assert.strictEqual(productSourceId('some-product-name'), 'someproductname');
    assert.strictEqual(productSourceId('  SOME-product NAME '), 'someproductname');
  });

  it('strips trailing slashes and query params/hashes in fallback', () => {
    assert.strictEqual(productSourceId('some-product-name/?foo=bar'), 'someproductname');
    assert.strictEqual(productSourceId('some-product-name#foo'), 'someproductname');
    assert.strictEqual(productSourceId('some-product-name?foo=bar#baz'), 'someproductname');
    assert.strictEqual(productSourceId('some-product-name/'), 'someproductname');
  });

  it('normalizes Persian/Arabic digits in fallback', () => {
    assert.strictEqual(productSourceId('product-۱۲۳۴۵'), 'product12345');
    assert.strictEqual(productSourceId('product-١٢٣٤٥'), 'product12345');
  });

  it('normalizes special characters in fallback', () => {
    assert.strictEqual(productSourceId('ك'), 'ک');
    assert.strictEqual(productSourceId('يى'), 'یی');
  });
});
