import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_INVESTOR_SETTINGS, normalizeInvestorSettings } from '../src/services/investor-model.js';

test('investor settings default to the agreed ten-billion toman, 60/40 model', () => {
  assert.deepEqual(normalizeInvestorSettings(null), DEFAULT_INVESTOR_SETTINGS);
  assert.equal(DEFAULT_INVESTOR_SETTINGS.initialCapital, 10_000_000_000);
  assert.equal(DEFAULT_INVESTOR_SETTINGS.investorSharePercent, 60);
  assert.equal(DEFAULT_INVESTOR_SETTINGS.executorSharePercent, 40);
});

test('executor share is always the exact complement of investor share', () => {
  const result = normalizeInvestorSettings({
    initialCapital: 12_500_000_000,
    investorSharePercent: 67.5,
    executorSharePercent: 99,
    companyLabel: '  مشارکت آزمایشی  ',
  });
  assert.equal(result.investorSharePercent, 67.5);
  assert.equal(result.executorSharePercent, 32.5);
  assert.equal(result.companyLabel, 'مشارکت آزمایشی');
});

test('invalid financial configuration is bounded and cannot create negative capital', () => {
  const result = normalizeInvestorSettings({
    initialCapital: -1,
    investorSharePercent: 140,
    executorSharePercent: -40,
    companyLabel: '',
  });
  assert.equal(result.initialCapital, 0);
  assert.equal(result.investorSharePercent, 100);
  assert.equal(result.executorSharePercent, 0);
  assert.equal(result.companyLabel, DEFAULT_INVESTOR_SETTINGS.companyLabel);
});
