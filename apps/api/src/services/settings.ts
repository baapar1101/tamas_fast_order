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
