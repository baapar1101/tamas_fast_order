import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignDraftSchema, NATIVE_DESTINATIONS } from '@tamas/shared';
import { campaignPayload } from '../src/services/native-campaigns.js';

test('campaign input requires recipients and only permits known native pages', () => {
  const draft = { title: 'عنوان', body: 'متن پیام', destination: 'wallet', audience: 'selected', userIds: [2, 1, 2] };
  assert.deepEqual(campaignDraftSchema.parse(draft).userIds, [1, 2]);
  assert.equal(campaignDraftSchema.safeParse({ ...draft, userIds: [] }).success, false);
  assert.equal(campaignDraftSchema.safeParse({ ...draft, destination: 'https://example.invalid' }).success, false);
  assert.equal(campaignDraftSchema.safeParse({ ...draft, body: 'x'.repeat(601) }).success, false);
  assert.equal(campaignDraftSchema.safeParse({ ...draft, audience: 'all', userIds: [1], userId: 99 }).success, false);
  assert.deepEqual(campaignDraftSchema.parse({ ...draft, audience: 'all' }).userIds, []);
});
test('custom notification preserves Android security and Expo routing metadata', () => {
  for (const destination of NATIVE_DESTINATIONS) {
    const message = campaignPayload({ id: 7, title: 'اعلان آزمایشی', body: 'متن پیام', destination }, 11);
    assert.equal(message.notification.title, 'اعلان آزمایشی');
    assert.equal(message.notification.body, 'متن پیام');
    assert.equal(message.android.notification.proxy, 'DENY');
    assert.equal(message.android.notification.visibility, 'PRIVATE');
    assert.equal(JSON.parse(message.data.body).destination, destination);
    assert.equal(JSON.parse(message.data.body).deliveryId, '11');
    assert.equal(message.data.campaignId, '7');
    assert.ok(!JSON.stringify(message).includes('phone'));
  }
});
