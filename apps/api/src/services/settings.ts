import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { settings } from '../db/schema.js';
import { TtlCache } from '../lib/cache.js';

const cache = new TtlCache<Record<string, string>>(30_000, 4);

export async function generateSecret(): Promise<string> {
  const { randomBytes } = await import('node:crypto');
  return randomBytes(32).toString('hex');
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const hit = cache.get('all');
  if (hit) return hit;
  const rows = await db.select().from(settings).where(isNull(settings.deletedAt));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cache.set('all', map);
  return map;
}

export async function getSetting(key: string): Promise<string | null> {
  const all = await getAllSettings();
  return all[key] ?? null;
}

function getFromProcess(key: string): string | undefined {
  return typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
}

function parseBool(value: string | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
}

export function privatePrefix(): string {
  return 'private_';
}

export interface CrmConfig {
  apiBase: string;
  apiKey: string;
  businessId: number;
  webhookSecret: string;
  syncEnabled: boolean;
  syncDebounceMs: number;
}

/** Build CRM config, preferring DB settings, falling back to env. */
export async function getCrmConfig(): Promise<CrmConfig> {
  const dbSettings = await getAllSettings();

  const apiBase = (dbSettings.CRM_API_BASE ?? '').trim() || getFromProcess('CRM_API_BASE')?.trim() || 'https://tamastore.ir';
  const apiKey = (dbSettings.CRM_API_KEY ?? '').trim() || getFromProcess('CRM_API_KEY')?.trim() || '';
  const businessId = Number((dbSettings.CRM_BUSINESS_ID ?? '').trim() || getFromProcess('CRM_BUSINESS_ID')?.trim() || '1');
  const webhookSecret = (dbSettings.CRM_WEBHOOK_SECRET ?? '').trim() || getFromProcess('CRM_WEBHOOK_SECRET')?.trim() || '';
  const syncEnabled = parseBool(
    dbSettings.CRM_SYNC_ENABLED ?? getFromProcess('CRM_SYNC_ENABLED') ?? true,
  );
  const syncDebounceMs = Math.max(
    0,
    Number(dbSettings.CRM_SYNC_DEBOUNCE_MS ?? getFromProcess('CRM_SYNC_DEBOUNCE_MS') ?? 500) || 500,
  );

  return { apiBase, apiKey, businessId, webhookSecret, syncEnabled, syncDebounceMs };
}

export interface CrmPublicConfig {
  apiBase: string;
  businessId: number;
  syncEnabled: boolean;
  syncDebounceMs: number;
}

/** CRM config safe to expose to the site (no API key / webhook secret). */
export async function getPublicConfig(): Promise<CrmPublicConfig> {
  const { apiBase, businessId, syncEnabled, syncDebounceMs } = await getCrmConfig();
  return { apiBase, businessId, syncEnabled, syncDebounceMs };
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  const all = await getAllSettings();
  return Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith(privatePrefix())));
}

export async function hasSetting(key: string): Promise<boolean> {
  return getSetting(key).then((v) => v !== null);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date(), deletedAt: null } });
  cache.clear();
}

export async function setSettings(values: Record<string, string>): Promise<void> {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
  if (rows.length > 0) {
    await db.insert(settings).values(rows).onConflictDoUpdate({
      target: settings.key,
      set: { value: rows[0]!.value, updatedAt: new Date(), deletedAt: null },
    });
  }
  cache.clear();
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
  cache.clear();
}

export function invalidateSettings(): void {
  cache.clear();
}
