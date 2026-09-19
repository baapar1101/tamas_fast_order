import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { settings } from '../db/schema.js';
import { TtlCache } from '../lib/cache.js';

const cache = new TtlCache<Record<string, string>>(30_000, 4);

/**
 * Keys prefixed `private_` never leave the admin API — the settings tab is the
 * natural place for things like a courier's phone number.
 */
const PRIVATE_PREFIX = 'private_';

export async function getAllSettings(): Promise<Record<string, string>> {
  const hit = cache.get('all');
  if (hit) return hit;
  const rows = await db.select().from(settings).where(isNull(settings.deletedAt));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cache.set('all', map);
  return map;
}

export interface CrmConfig {
  apiBase: string;
  apiKey: string;
  businessId: number;
  webhookSecret: string;
  syncEnabled: boolean;
  syncDebounceMs: number;
}

export async function getCrmConfig(): Promise<CrmConfig> {
  const dbSettings = await getAllSettings();

  // Read from database settings first, fall back to env
  const apiBase = (dbSettings.CRM_API_BASE ?? '').trim()
    || (typeof process !== 'undefined' && process.env.CRM_API_BASE)?.trim()
    || 'https://tamastore.ir';
  const apiKey = (dbSettings.CRM_API_KEY ?? '').trim()
    || (typeof process !== 'undefined' && process.env.CRM_API_KEY)?.trim()
    || '';
  const businessIdStr = (dbSettings.CRM_BUSINESS_ID ?? '').trim()
    || (typeof process !== 'undefined' && process.env.CRM_BUSINESS_ID)?.trim()
    || '1';
  const webhookSecret = (dbSettings.CRM_WEBHOOK_SECRET ?? '').trim()
    || (typeof process !== 'undefined' && process.env.CRM_WEBHOOK_SECRET)?.trim()
    || '';
  const syncEnabledRaw = dbSettings.CRM_SYNC_ENABLED ?? (typeof process !== 'undefined' && process.env.CRM_SYNC_ENABLED);
  const syncEnabled = typeof syncEnabledRaw === 'boolean'
    ? syncEnabledRaw
    : !['false', '0', 'no', 'off'].includes(String(syncEnabledRaw).toLowerCase());
  const syncDebounceMsRaw = dbSettings.CRM_SYNC_DEBOUNCE_MS ?? (typeof process !== 'undefined' && process.env.CRM_SYNC_DEBOUNCE_MS);
  const syncDebounceMs = Math.max(0, Number(syncDebounceMsRaw) || 500);

  return { apiBase, apiKey, businessId: Number(businessIdStr), webhookSecret, syncEnabled, syncDebounceMs };
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  const all = await getAllSettings();
  return Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith(PRIVATE_PREFIX)));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date(), deletedAt: null } });
  cache.clear();
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
  cache.clear();
}

export function invalidateSettings(): void {
  cache.clear();
}