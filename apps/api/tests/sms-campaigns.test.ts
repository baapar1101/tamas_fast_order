import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRecipients, hashSmsRecipientPhone, matchesQueuedPhone, previewFingerprint, smsCampaignInput } from '../src/services/sms-campaigns.js';

test('SMS campaign input limits message and selected recipients', () => {
  assert.equal(smsCampaignInput.safeParse({ body: 'سلام', audience: 'all', userIds: [] }).success, true);
  assert.equal(smsCampaignInput.safeParse({ body: '   ', audience: 'all', userIds: [] }).success, false);
  assert.equal(smsCampaignInput.safeParse({ body: 'x'.repeat(1001), audience: 'all', userIds: [] }).success, false);
  assert.equal(smsCampaignInput.safeParse({ body: 'سلام', audience: 'selected', userIds: [] }).success, false);
  assert.equal(smsCampaignInput.safeParse({ body: 'سلام', audience: 'selected', userIds: [1, 1] }).success, false);
  assert.equal(smsCampaignInput.safeParse({ body: 'سلام', audience: 'all', userIds: [1] }).success, false);
  assert.equal(smsCampaignInput.safeParse({ body: 'سلام', audience: 'all', userIds: [], phone: '09120000000' }).success, false);
});

test('recipient snapshot normalizes phones, rejects invalid numbers and deduplicates', () => {
  const rows = canonicalRecipients([
    { id: 1, phone: '+989123456789', name: '', lastName: '' },
    { id: 2, phone: '۰۹۱۲۳۴۵۶۷۸۹', name: '', lastName: '' },
    { id: 3, phone: '12345', name: '', lastName: '' },
    { id: 4, phone: '09121111111', name: '', lastName: '' },
  ]);
  assert.deepEqual(rows.map(row => [row.id, row.phone]), [[1, '09123456789'], [4, '09121111111']]);
});

test('SMS preview token changes when message, audience or recipient changes', () => {
  const input = smsCampaignInput.parse({ body: 'خبر جدید', audience: 'all', userIds: [] });
  const rows = [{ id: 1, phone: '09123456789' }];
  const token = previewFingerprint(input, rows);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, previewFingerprint({ ...input, body: 'خبر دیگر' }, rows));
  assert.notEqual(token, previewFingerprint({ ...input, audience: 'selected', userIds: [1] }, rows));
  assert.notEqual(token, previewFingerprint(input, [{ id: 1, phone: '09121111111' }]));
});

test('a changed or removed phone cannot receive a queued campaign message', () => {
  const hash = hashSmsRecipientPhone('09123456789');
  assert.equal(matchesQueuedPhone('+989123456789', hash), true);
  assert.equal(matchesQueuedPhone('09121111111', hash), false);
  assert.equal(matchesQueuedPhone(undefined, hash), false);
});
