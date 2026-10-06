import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, randomDigits, randomToken, rowHash, safeEqualHex, sha256, verifyPassword } from '../src/lib/hash.js';

describe('hash utilities', () => {
  it('creates stable SHA-256 and row hashes', () => {
    assert.equal(sha256('hello'), '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    assert.equal(rowHash(['a', 1, null, ' b ']), rowHash(['a', '1', '', 'b']));
  });

  it('creates random tokens and fixed-length numeric codes', () => {
    assert.notEqual(randomToken(), randomToken());
    assert.match(randomDigits(6), /^\d{6}$/u);
  });

  it('compares only valid, non-empty, equal-length hexadecimal values', () => {
    assert.equal(safeEqualHex('deadbeef', 'deadbeef'), true);
    assert.equal(safeEqualHex('deadbeef', 'deadbeee'), false);
    assert.equal(safeEqualHex('deadbeef', 'deadbeef00'), false);
    assert.equal(safeEqualHex('zz', 'yy'), false);
    assert.equal(safeEqualHex('', ''), false);
  });

  it('hashes and verifies passwords with unique salts', () => {
    const first = hashPassword('secret-password');
    const second = hashPassword('secret-password');
    assert.notEqual(first, second);
    assert.equal(verifyPassword('secret-password', first), true);
    assert.equal(verifyPassword('wrong-password', first), false);
    assert.equal(verifyPassword('secret-password', 'invalid'), false);
  });
});
