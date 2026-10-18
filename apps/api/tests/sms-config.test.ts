import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decryptSmsSecret, encryptSmsSecret } from '../src/services/sms-config.js';

describe('SMS provider secret storage', () => {
  it('encrypts secrets at rest and decrypts them for server-side use', () => {
    const secret = 'provider-api-key-123';
    const encrypted = encryptSmsSecret(secret);
    assert.match(encrypted, /^enc:v1:/);
    assert.equal(encrypted.includes(secret), false);
    assert.equal(decryptSmsSecret(encrypted), secret);
  });

  it('rejects tampered encrypted values', () => {
    const encrypted = encryptSmsSecret('provider-api-key-123');
    assert.equal(decryptSmsSecret(`${encrypted}x`), '');
  });
});
