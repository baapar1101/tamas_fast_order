import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products } from '../db/schema.js';
import { env } from '../env.js';
import { invalidateCatalog } from './catalog.js';
import { enqueueCrmProductSync } from './crm-product-sync.js';
import { normalizeExcelSku } from './sheets/excel-stock-parser.js';
import { bucket, storage } from './storage/index.js';

const MAX_GALLERY = 12;

function uploadsPrefix(): string {
  return `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/`;
}

/**
 * The site-relative path of a photo stored by this site ("/uploads/…"), from
 * either that path or a full link to it on any host; null for anything else.
 */
export function storedPhotoPath(url: string | null | undefined): string | null {
  const clean = String(url ?? '').trim();
  if (!clean) return null;
  let path = clean;
  if (/^https?:\/\//i.test(clean)) {
    try {
      path = new URL(clean).pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith(uploadsPrefix()) || path.includes('..')) return null;
  return decodeURI(path);
}

/**
 * Whether a product photo actually loads: a stored file must exist (in the
 * bucket or on disk); other links are trusted. `known` is an optional listing
 * of the bucket, so a whole catalogue is checked without a request per photo.
 */
export async function photoExists(
  url: string | null | undefined,
  cache = new Map<string, Promise<boolean>>(),
  known?: Set<string>,
): Promise<boolean> {
  const clean = String(url ?? '').trim();
  if (!clean) return false;
  const path = storedPhotoPath(clean);
  if (!path) return /^https?:\/\//i.test(clean);
  let task = cache.get(path);
  if (!task) {
    const key = path.slice(uploadsPrefix().length);
    task = known?.has(key) ? Promise.resolve(true) : storage.exists(key).catch(() => false);
    cache.set(path, task);
  }
  return task;
}

/** Ids of live products whose main photo is empty or missing from storage. */
export async function productIdsWithoutPhoto(): Promise<number[]> {
  const rows = await db.select({ id: products.id, imageUrl: products.imageUrl }).from(products).where(isNull(products.deletedAt));
  const cache = new Map<string, Promise<boolean>>();
  const known = await bucket()?.listKeys().catch(() => undefined);
  const checks = await Promise.all(rows.map(async (row) => ({ id: row.id, ok: await photoExists(row.imageUrl, cache, known) })));
  return checks.filter((row) => !row.ok).map((row) => row.id);
}

export interface PhotoAttachItem {
  /** SKU or site product code, as read from the photo's file name. */
  code: string;
  imageUrl: string;
  gallery: string[];
}

export type PhotoAttachStatus = 'updated' | 'skipped' | 'not_found' | 'duplicate' | 'invalid';

export interface PhotoAttachResult {
  code: string;
  status: PhotoAttachStatus;
  message: string;
  productId?: string;
  title?: string;
}

/**
 * Puts uploaded photos on existing products, matched by SKU (leading zero
 * restored, like the Excel update) or by the site's product code. With
 * onlyMissing, products whose current photo still loads keep it.
 */
export async function attachProductPhotos(items: PhotoAttachItem[], options: { onlyMissing: boolean }): Promise<{
  results: PhotoAttachResult[];
  updated: number;
}> {
  const rows = await db
    .select({ id: products.id, productId: products.productId, sku: products.sku, title: products.title, imageUrl: products.imageUrl })
    .from(products)
    .where(isNull(products.deletedAt));
  const bySku = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normalizeExcelSku(row.sku);
    if (!key) continue;
    bySku.set(key, [...(bySku.get(key) ?? []), row]);
  }
  const byProductId = new Map(rows.map((row) => [row.productId, row]));
  const cache = new Map<string, Promise<boolean>>();
  const results: PhotoAttachResult[] = [];
  const changed: Array<{ id: number; productId: string }> = [];

  for (const item of items) {
    const code = item.code.trim();
    const main = storedPhotoPath(item.imageUrl);
    const gallery = item.gallery.map(storedPhotoPath).filter((url): url is string => Boolean(url)).slice(0, MAX_GALLERY);
    if (!code || !main) {
      results.push({ code, status: 'invalid', message: 'کد کالا یا لینک عکس معتبر نیست؛ فقط عکس‌های آپلودشده در همین سایت قبول است.' });
      continue;
    }
    const skuMatches = bySku.get(normalizeExcelSku(code)) ?? [];
    if (skuMatches.length > 1) {
      results.push({ code, status: 'duplicate', message: `این کد برای ${skuMatches.length} کالا ثبت شده است: ${skuMatches.map((row) => row.productId).join('، ')}` });
      continue;
    }
    const product = skuMatches[0] ?? byProductId.get(code);
    if (!product) {
      results.push({ code, status: 'not_found', message: 'کالایی با این کد پیدا نشد.' });
      continue;
    }
    const base = { code, productId: product.productId, title: product.title };
    if (changed.some((entry) => entry.id === product.id)) {
      results.push({ ...base, status: 'duplicate', message: 'عکس‌های این کالا با کد دیگری هم آمده است.' });
      continue;
    }
    if (options.onlyMissing && await photoExists(product.imageUrl, cache)) {
      results.push({ ...base, status: 'skipped', message: 'عکس فعلی کالا سالم است و دست نخورد.' });
      continue;
    }
    await db.update(products).set({ imageUrl: main, gallery, updatedAt: new Date() }).where(eq(products.id, product.id));
    changed.push({ id: product.id, productId: product.productId });
    results.push({ ...base, status: 'updated', message: `عکس اصلی${gallery.length ? ` و ${gallery.length} عکس گالری` : ''} ثبت شد.` });
  }

  if (changed.length) {
    invalidateCatalog();
    for (const { productId } of changed) {
      await enqueueCrmProductSync(productId, 'update', { source: 'photo-attach' }).catch(() => undefined);
    }
  }
  return { results, updated: changed.length };
}
