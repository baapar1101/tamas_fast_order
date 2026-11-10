import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { decryptSmsSecret, encryptSmsSecret } from '../src/services/sms-config.js';
import { env } from '../src/env.js';

describe('SMS provider secret storage', () => {
  it('encrypts secrets at rest and decrypts them for server-side use', () => {
    const secret = 'provider-api-key-123';
    const encrypted = encryptSmsSecret(secret);
    assert.match(encrypted, /^enc:v2:/);
    assert.equal(encrypted.includes(secret), false);
    assert.equal(decryptSmsSecret(encrypted), secret);
  });

  it('decrypts older v1 secrets for backward compatibility', () => {
    const secret = 'provider-api-key-123-v1';

    // Simulate v1 encryption
    const v1Key = createHash('sha256').update(`${env.APP_SECRET}:sms-config:v1`).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', v1Key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encryptedV1 = `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;

    assert.equal(decryptSmsSecret(encryptedV1), secret);
  });

  it('rejects tampered encrypted values', () => {
    const encrypted = encryptSmsSecret('provider-api-key-123');
    assert.equal(decryptSmsSecret(`${encrypted}x`), '');
  });
});
