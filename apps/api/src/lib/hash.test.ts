import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sha256,
  rowHash,
  randomToken,
  randomDigits,
  safeEqualHex,
  hashPassword,
  verifyPassword,
} from './hash.js';

describe('hash', () => {
  describe('sha256', () => {
    it('should correctly hash a string using sha256', () => {
      // sha256('hello') -> 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      assert.strictEqual(
        sha256('hello'),
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
      );
      assert.strictEqual(
        sha256(''),
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    });
  });

  describe('rowHash', () => {
    it('should generate a consistent hash for an array of values', () => {
      const arr = ['a', 1, null, ' b '];
      const hash1 = rowHash(arr);
      const hash2 = rowHash(['a', '1', '', 'b']);
      assert.strictEqual(hash1, hash2);
    });

    it('should handle empty arrays', () => {
      assert.strictEqual(
        rowHash([]),
        sha256('') // empty string hash
      );
    });
  });

  describe('randomToken', () => {
    it('should generate a random base64url token of correct length', () => {
      const token = randomToken(32);
      // base64 encoding of 32 bytes is ceil(32/3)*4 = 44 characters
      // base64url removes padding '=' sometimes, but 32 bytes -> 43 chars in base64url without padding
      assert.strictEqual(typeof token, 'string');
      assert.ok(token.length >= 42 && token.length <= 44);

      const token2 = randomToken(16);
      assert.ok(token2.length >= 21 && token2.length <= 22);
    });

    it('should generate unique tokens', () => {
      const token1 = randomToken();
      const token2 = randomToken();
      assert.notStrictEqual(token1, token2);
    });
  });

  describe('randomDigits', () => {
    it('should generate a string of random digits of specified length', () => {
      const digits = randomDigits(6);
      assert.strictEqual(digits.length, 6);
      assert.ok(/^\d{6}$/.test(digits));
    });

    it('should handle length 0', () => {
      assert.strictEqual(randomDigits(0), '');
    });
  });

  describe('safeEqualHex', () => {
    it('should return true for equal hex strings', () => {
      const a = 'deadbeef';
      const b = 'deadbeef';
      assert.strictEqual(safeEqualHex(a, b), true);
    });

    it('should return false for unequal hex strings of same length', () => {
      const a = 'deadbeef';
      const b = 'deadbeee';
      assert.strictEqual(safeEqualHex(a, b), false);
    });

    it('should return false for hex strings of different lengths', () => {
      const a = 'deadbeef';
      const b = 'deadbeef00';
      assert.strictEqual(safeEqualHex(a, b), false);
    });

    it('should return false for invalid hex strings', () => {
      const a = 'deadbeef';
      const b = 'invalidx';
      assert.strictEqual(safeEqualHex(a, b), false);
    });
  });

  describe('hashPassword and verifyPassword', () => {
    it('should hash and successfully verify a valid password', () => {
      const password = 'mySecretPassword123!';
      const hash = hashPassword(password);

      assert.ok(hash.includes(':'));
      assert.strictEqual(verifyPassword(password, hash), true);
    });

    it('should fail verification for an invalid password', () => {
      const password = 'mySecretPassword123!';
      const hash = hashPassword(password);

      assert.strictEqual(verifyPassword('wrongPassword', hash), false);
    });

    it('should generate unique hashes for the same password due to salting', () => {
      const password = 'mySecretPassword123!';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      assert.notStrictEqual(hash1, hash2);
    });

    it('should return false for invalid stored hash formats', () => {
      assert.strictEqual(verifyPassword('password', ''), false);
      assert.strictEqual(verifyPassword('password', 'invalidformat'), false);
      assert.strictEqual(verifyPassword('password', 'salt:'), false);
      assert.strictEqual(verifyPassword('password', ':hash'), false);
    });
  });
});
