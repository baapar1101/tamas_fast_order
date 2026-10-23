import assert from 'node:assert/strict';
import test from 'node:test';
import { creditReportExpiresAt } from '../src/services/credit-reports.js';
import { normalizeCreditReportText } from '../src/services/ics-credit-report.js';

test('normalizes Persian report text and digits for reliable parsing', () => {
  assert.equal(normalizeCreditReportText('  كد ملي: ۵۸۳٠٠۵٠١٩۶  '), 'کد ملی: 5830050196');
});

test('credit reports expire exactly two calendar months after upload', () => {
  assert.equal(creditReportExpiresAt(new Date('2026-10-23T10:00:00.000Z')).toISOString(), '2026-12-23T10:00:00.000Z');
});
