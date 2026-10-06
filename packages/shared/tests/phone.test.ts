import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidPhone, normalizeLandline, normalizePhone, toAsciiDigits } from '../src/phone.js';

describe('phone utilities', () => {
  it('normalizes Persian, Arabic, and mixed digits', () => {
    assert.equal(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
    assert.equal(toAsciiDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
    assert.equal(toAsciiDigits('09۱۲3٤5'), '0912345');
  });

  it('normalizes supported Iranian mobile formats', () => {
    for (const input of ['09123456789', '9123456789', '+989123456789', '00989123456789', '۰۹۱۲۳۴۵۶۷۸۹']) {
      assert.equal(normalizePhone(input), '09123456789');
      assert.equal(isValidPhone(input), true);
    }
  });

  it('rejects invalid mobile numbers', () => {
    for (const input of ['08123456789', '0912345678', '091234567890', 'invalid', null, undefined]) {
      assert.equal(isValidPhone(input), false);
    }
  });

  it('normalizes landlines without changing their prefix', () => {
    assert.equal(normalizeLandline('۰۲۱-۱۲۳۴۵۶۷۸'), '02112345678');
  });
});
