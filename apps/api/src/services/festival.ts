import {
  FESTIVAL_SETTING_KEY,
  LEGACY_CAMPAIGN_SETTING_KEY,
  festivalState,
  parseFestivalConfig,
  type FestivalConfig,
  type FestivalState,
} from '@tamas/shared';
import { getSetting } from './settings.js';

/** The festival as saved in the admin settings (or the older campaign switch). */
export async function getFestivalConfig(): Promise<FestivalConfig> {
  const [raw, legacy] = await Promise.all([getSetting(FESTIVAL_SETTING_KEY), getSetting(LEGACY_CAMPAIGN_SETTING_KEY)]);
  return parseFestivalConfig(raw, legacy);
}

/**
 * What the festival changes at this moment. A scheduled festival starts and
 * stops by itself: the state is worked out from the clock on every call, and
 * settings are cached for 30 seconds at most.
 */
export async function getFestivalState(now: Date = new Date()): Promise<FestivalState> {
  return festivalState(await getFestivalConfig(), now);
}
