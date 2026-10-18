import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidJalaliDate, normalizeJalaliDate, splitJalaliDate } from '../src/jalali-date.js';

test('normalizes Persian digits and common Jalali date separators', () => {
  assert.equal(normalizeJalaliDate('۱۳۷۷/۹/۳'), '1377-09-03');
  assert.equal(normalizeJalaliDate('13770930'), '1377-09-30');
  assert.deepEqual(splitJalaliDate('۱۳۶۵.۱۲.۲۹'), { year: '1365', month: '12', day: '29' });
});

test('validates Jalali date ranges used by identity inquiry', () => {
  assert.equal(isValidJalaliDate('1377-09-30', 1405), true);
  assert.equal(isValidJalaliDate('1377-07-31', 1405), false);
  assert.equal(isValidJalaliDate('1377-13-01', 1405), false);
  assert.equal(isValidJalaliDate('1406-01-01', 1405), false);
});
