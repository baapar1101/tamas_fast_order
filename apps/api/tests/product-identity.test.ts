import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeProductIdentity,
  productSourceId,
  productIdentityKey,
} from '../src/services/product-identity.js';

describe('product-identity', () => {
  describe('normalizeProductIdentity', () => {
    it('handles null, undefined, and non-string types', () => {
      assert.equal(normalizeProductIdentity(null), '');
      assert.equal(normalizeProductIdentity(undefined), '');
      assert.equal(normalizeProductIdentity(123), '123');
      assert.equal(normalizeProductIdentity({}), 'objectobject');
    });

    it('performs NFKC normalization', () => {
      // Examples of NFKC equivalence
      assert.equal(normalizeProductIdentity('ﬃ'), 'ffi');
      assert.equal(normalizeProductIdentity('①'), '1');
    });

    it('converts Arabic to Persian characters', () => {
      assert.equal(normalizeProductIdentity('ي'), 'ی');
      assert.equal(normalizeProductIdentity('ى'), 'ی');
      assert.equal(normalizeProductIdentity('ك'), 'ک');
      assert.equal(normalizeProductIdentity('عليك'), 'علیک');
    });

    it('removes zero-width and BIDI control characters', () => {
      assert.equal(normalizeProductIdentity('آب\u200Cمیوه'), 'آبمیوه'); // ZWNJ
      assert.equal(normalizeProductIdentity('test\u200Dtest'), 'testtest'); // ZWJ
      assert.equal(normalizeProductIdentity('test\u202Atest'), 'testtest'); // LRE
    });

    it('converts Persian and Arabic digits to English digits', () => {
      assert.equal(normalizeProductIdentity('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
      assert.equal(normalizeProductIdentity('٠١٢٣٤٥٦٧٨٩'), '0123456789');
      assert.equal(normalizeProductIdentity('تست۱۲۳'), 'تست123');
    });

    it('lowercases strings including English letters', () => {
      assert.equal(normalizeProductIdentity('Apple iPhone'), 'appleiphone');
      assert.equal(normalizeProductIdentity('Test'), 'test');
    });

    it('removes whitespace, punctuation, and symbols', () => {
      assert.equal(normalizeProductIdentity('Hello, World!'), 'helloworld');
      assert.equal(normalizeProductIdentity(' گوشی  موبایل '), 'گوشیموبایل');
      assert.equal(normalizeProductIdentity('Samsung Galaxy S24 Ultra (256GB) - Titanium Black'), 'samsunggalaxys24ultra256gbtitaniumblack');
    });
  });

  describe('productSourceId', () => {
    it('extracts digits from DKP strings', () => {
      assert.equal(productSourceId('dkp-12345'), '12345');
      assert.equal(productSourceId('DKP-67890'), '67890');
    });

    it('extracts digits from URL paths', () => {
      assert.equal(productSourceId('/product/12345'), '12345');
      assert.equal(productSourceId('/products/67890'), '67890');
      assert.equal(productSourceId('https://www.digikala.com/product/dkp-12345/apple-iphone/'), '12345');
    });

    it('falls back to normalized string for unrecognized formats', () => {
      assert.equal(productSourceId('Apple iPhone'), 'appleiphone');
      assert.equal(productSourceId('https://example.com/item?id=123'), 'httpsexamplecomitem');
      assert.equal(productSourceId('some/path/'), 'somepath');
    });

    it('returns an empty string for falsy/whitespace values', () => {
      assert.equal(productSourceId(''), '');
      assert.equal(productSourceId('   '), '');
      assert.equal(productSourceId(null), '');
      assert.equal(productSourceId(undefined), '');
    });
  });

  describe('productIdentityKey', () => {
    it('generates a pipe-separated key title|model|color|type', () => {
      assert.equal(
        productIdentityKey({
          title: 'Apple iPhone 15 Pro',
          model: 'A3102',
          color: 'Blue Titanium',
          type: 'physical'
        }),
        'appleiphone15pro|a3102|bluetitanium|physical'
      );
    });

    it('uses colorEn if color is not provided', () => {
      assert.equal(
        productIdentityKey({
          title: 'Samsung S24',
          colorEn: 'Black'
        }),
        'samsungs24||black|physical'
      );
    });

    it('defaults type to physical if not provided', () => {
      assert.equal(
        productIdentityKey({
          title: 'Test Product'
        }),
        'testproduct|||physical'
      );
    });

    it('returns an empty string if title is falsy after normalization', () => {
      assert.equal(
        productIdentityKey({
          title: '   ',
          model: 'Model'
        }),
        ''
      );
      assert.equal(
        productIdentityKey({
          title: null,
          model: 'Model'
        }),
        ''
      );
    });
  });
});
