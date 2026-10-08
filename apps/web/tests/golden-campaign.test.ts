import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GOLDEN_CAMPAIGN_END_AT,
  GOLDEN_CAMPAIGN_IMAGE_URL,
  visibleCampaignSlides,
} from '../src/storefront/goldenCampaign';

const campaign = { imageUrl: GOLDEN_CAMPAIGN_IMAGE_URL };
const evergreen = { imageUrl: '/assets/slides/slide-01.jpg' };

test('campaign is the first slide until the end of 20 Mehr 1405 in Tehran', () => {
  assert.equal(GOLDEN_CAMPAIGN_END_AT, Date.parse('2026-10-12T20:30:00.000Z'));
  assert.deepEqual(visibleCampaignSlides([campaign, evergreen], GOLDEN_CAMPAIGN_END_AT - 1), [campaign, evergreen]);
});

test('campaign disappears exactly at midnight on 21 Mehr, other slides stay', () => {
  assert.deepEqual(visibleCampaignSlides([campaign, evergreen], GOLDEN_CAMPAIGN_END_AT), [evergreen]);
  assert.deepEqual(visibleCampaignSlides([campaign, evergreen], GOLDEN_CAMPAIGN_END_AT + 1), [evergreen]);
});
