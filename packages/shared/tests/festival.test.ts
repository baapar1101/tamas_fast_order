import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FESTIVAL_CONFIG,
  festivalConfigSchema,
  festivalSlides,
  festivalState,
  isoToTehranJalali,
  jalaliToGregorian,
  parseFestivalConfig,
  tehranJalaliToIso,
  type FestivalConfig,
} from '../src/festival.js';

const scheduled: FestivalConfig = {
  ...DEFAULT_FESTIVAL_CONFIG,
  mode: 'scheduled',
  startsAt: '2026-11-20T18:00:00+03:30',
  endsAt: '2026-11-22T00:00:00+03:30',
  festivalSlideIds: [9, 10],
};

test('jalali dates convert to the right gregorian day', () => {
  assert.deepEqual(jalaliToGregorian(1405, 1, 1), { gy: 2026, gm: 3, gd: 21 });
  assert.deepEqual(jalaliToGregorian(1405, 8, 24), { gy: 2026, gm: 11, gd: 15 });
  assert.deepEqual(jalaliToGregorian(1403, 12, 30), { gy: 2025, gm: 3, gd: 20 });
  assert.equal(jalaliToGregorian(1404, 12, 30), null);
  assert.equal(jalaliToGregorian(1405, 7, 31), null);
});

test('tehran jalali date and time round-trip through ISO', () => {
  const iso = tehranJalaliToIso('۱۴۰۵/۰۸/۲۹', '18:00');
  assert.equal(iso, '2026-11-20T18:00:00+03:30');
  assert.deepEqual(isoToTehranJalali(iso), { date: '1405/08/29', time: '18:00' });
  assert.equal(tehranJalaliToIso('1405/13/01', '10:00'), null);
  assert.equal(tehranJalaliToIso('1405/08/29', '25:00'), null);
});

test('a scheduled festival runs only inside its window', () => {
  assert.equal(festivalState(scheduled, new Date('2026-11-20T14:29:00Z')).phase, 'upcoming');
  const running = festivalState(scheduled, new Date('2026-11-20T14:31:00Z'));
  assert.equal(running.active, true);
  assert.equal(running.onlyFestivalProducts, true);
  assert.equal(running.festivalPaymentTerms, true);
  const ended = festivalState(scheduled, new Date('2026-11-21T20:30:00Z'));
  assert.equal(ended.phase, 'ended');
  assert.equal(ended.onlyFestivalProducts, false);
});

test('festival banners hide outside the festival; others hide during it when asked', () => {
  const slides = [{ id: 8 }, { id: 9 }, { id: 10 }];
  const before = festivalState(scheduled, new Date('2026-11-19T10:00:00Z'));
  assert.deepEqual(festivalSlides(slides, before).map((s) => s.id), [8]);
  const during = festivalState(scheduled, new Date('2026-11-21T10:00:00Z'));
  assert.deepEqual(festivalSlides(slides, during).map((s) => s.id), [8, 9, 10]);
  const exclusive = festivalState({ ...scheduled, effects: { ...scheduled.effects, hideOtherBanners: true } }, new Date('2026-11-21T10:00:00Z'));
  assert.deepEqual(festivalSlides(slides, exclusive).map((s) => s.id), [9, 10]);
});

test('unticked effects stay off while the festival runs', () => {
  const state = festivalState({ ...scheduled, mode: 'on', effects: { onlyFestivalProducts: false, festivalPaymentTerms: true, festivalBanners: false, hideOtherBanners: false } });
  assert.equal(state.active, true);
  assert.equal(state.onlyFestivalProducts, false);
  assert.equal(state.festivalPaymentTerms, true);
  assert.deepEqual(state.hiddenSlideIds, []);
});

test('the legacy campaign switch reads as a running festival until one is saved', () => {
  const legacy = parseFestivalConfig(null, '2026-11-partial');
  assert.equal(legacy.mode, 'on');
  assert.equal(legacy.effects.onlyFestivalProducts, true);
  assert.equal(parseFestivalConfig(null, null).mode, 'off');
  assert.equal(parseFestivalConfig(JSON.stringify({ ...DEFAULT_FESTIVAL_CONFIG, mode: 'off' }), '2026-11-partial').mode, 'off');
  assert.equal(parseFestivalConfig('{bad json', null).mode, 'off');
});

test('a schedule needs both ends, in order', () => {
  assert.equal(festivalConfigSchema.safeParse({ ...scheduled, endsAt: null }).success, false);
  assert.equal(festivalConfigSchema.safeParse({ ...scheduled, endsAt: scheduled.startsAt }).success, false);
  assert.equal(festivalConfigSchema.safeParse(scheduled).success, true);
});
