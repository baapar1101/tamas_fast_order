import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_POINTS_CAMPAIGN_CONFIG,
  drawWeighted,
  maskPhone,
  parsePointsCampaignConfig,
  pointsCampaignPhase,
  publicFirstName,
} from '../src/points-campaign.js';

describe('points campaign', () => {
  const config = { ...DEFAULT_POINTS_CAMPAIGN_CONFIG, enabled: true, startsAt: '2026-12-10T20:30:00.000Z', endsAt: '2026-12-20T20:30:00.000Z' };

  it('moves through its phases', () => {
    assert.equal(pointsCampaignPhase({ ...config, enabled: false }), 'off');
    assert.equal(pointsCampaignPhase({ ...config, startsAt: null }), 'unscheduled');
    assert.equal(pointsCampaignPhase(config, new Date('2026-12-01T00:00:00Z')), 'upcoming');
    assert.equal(pointsCampaignPhase(config, new Date('2026-12-15T00:00:00Z')), 'running');
    assert.equal(pointsCampaignPhase(config, new Date('2026-12-20T20:30:00Z')), 'ended');
  });

  it('falls back to the default on broken settings', () => {
    assert.deepEqual(parsePointsCampaignConfig('{'), DEFAULT_POINTS_CAMPAIGN_CONFIG);
    assert.equal(parsePointsCampaignConfig(JSON.stringify(config)).enabled, true);
  });

  it('shows only a first name and a masked phone', () => {
    assert.equal(maskPhone('09121234567'), '0912***4567');
    assert.equal(publicFirstName('  علی رضایی '), 'علی');
    assert.equal(publicFirstName(''), 'همکار');
  });

  it('draws by points without picking anyone twice', () => {
    const people = [{ id: 1, points: 1 }, { id: 2, points: 98 }, { id: 3, points: 1 }, { id: 4, points: 0 }];
    // A ticket in the middle of the pool lands on the 98-point entrant.
    assert.equal(drawWeighted(people, 1, () => 0.5)[0]!.id, 2);
    const all = drawWeighted(people, 5, Math.random);
    assert.equal(all.length, 3, 'zero points never wins');
    assert.equal(new Set(all.map((p) => p.id)).size, 3);
    let heavy = 0;
    for (let i = 0; i < 2000; i += 1) if (drawWeighted(people, 1, Math.random)[0]!.id === 2) heavy += 1;
    assert.ok(heavy > 1800, `heavier entrant should win ~98% (won ${heavy}/2000)`);
  });
});
