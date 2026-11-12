import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LANDING_CONFIG, landingConfigSchema, parseLandingConfig } from '../src/landing.ts';

test('default landing config is valid', () => {
  assert.equal(landingConfigSchema.safeParse(DEFAULT_LANDING_CONFIG).success, true);
});

test('missing or broken landing settings fall back to the defaults', () => {
  assert.deepEqual(parseLandingConfig(null), DEFAULT_LANDING_CONFIG);
  assert.deepEqual(parseLandingConfig('{not json'), DEFAULT_LANDING_CONFIG);
  assert.deepEqual(parseLandingConfig(JSON.stringify({ version: 1 })), DEFAULT_LANDING_CONFIG);
});

test('saved landing settings are read back', () => {
  const saved = { ...DEFAULT_LANDING_CONFIG, partnersSkipLanding: false, sections: DEFAULT_LANDING_CONFIG.sections.slice(0, 2) };
  assert.deepEqual(parseLandingConfig(JSON.stringify(saved)), saved);
});

test('duplicate section ids are rejected', () => {
  const twice = { ...DEFAULT_LANDING_CONFIG, sections: [DEFAULT_LANDING_CONFIG.sections[0], DEFAULT_LANDING_CONFIG.sections[0]] };
  assert.equal(landingConfigSchema.safeParse(twice).success, false);
});
