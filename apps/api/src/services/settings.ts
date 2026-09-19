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

export async function getCrmConfig(): Promise<{
  apiBase: string;
  apiKey: string;
  businessId: number;
  webhookSecret: string;
  syncEnabled: boolean;
  syncDebounceMs: number;
}> {
  const dbSettings = await getAllSettings();
  
  // Read from database settings first, fall back to env
  const apiBase = dbSettings.CRM_API_BASE || (typeof process !== 'undefined' && process.env.CRM_API_BASE) || 'https://tamastore.ir';
  const apiKey = dbSettings.CRM_API_KEY || (typeof process !== 'undefined' && process.env.CRM_API_KEY) || '';
  const businessId = (dbSettings.CRM_BUSINESS_ID || (typeof process !== 'undefined' && process.env.CRM_BUSINESS_ID) || '1').trim();
  const webhookSecret = dbSettings.CRM_WEBHOOK_SECRET || (typeof process !== 'undefined' && process.env.CRM_WEBHOOK_SECRET) || '';
  const syncEnabled = dbSettings.CRM_SYNC_ENABLED !== 'false' && dbSettings.CRM_SYNC_ENABLED !== false;  // env fallback handled in crm.ts
  const syncDebounceMs = parseInt(dbSettings.CRM_SYNC_DEBOUNCE_MS || (typeof process !== 'undefined' && process.env.CRM_SYNC_DEBOUNCE_MS) || '500', 10);
  
  return { apiBase, apiKey, businessId: Number(businessId), webhookSecret, syncEnabled, syncDebounceMs };
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
