import { lookup } from 'node:dns/promises';
import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products } from '../db/schema.js';
import { env } from '../env.js';
import {
  isPrivateAddress,
  isRemoteImageUrl,
  isStoredImageUrl,
  legacyCacheStemForUrl,
  legacyImageFilename,
  normalizeStoredImageUrl,
} from '../lib/product-image-url.js';
import { invalidateCatalog } from './catalog.js';
import { processUpload } from './uploads.js';

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export interface ProductImageMirrorFailure {
  productId: string;
  url: string;
  error: string;
}

export interface ProductImageMirrorReport {
  scannedProducts: number;
  processedProducts: number;
  localizedImages: number;
  normalizedLocalImages: number;
  failedImages: number;
  remainingProducts: number;
  failures: ProductImageMirrorFailure[];
}

let running = false;
let legacyFilesPromise: Promise<Map<string, string>> | null = null;

function legacyCacheDirectories(): string[] {
  return [
    resolve(process.cwd(), '../web/public/uploads'),
    resolve(process.cwd(), 'apps/web/public/uploads'),
  ];
}

async function loadLegacyFiles(): Promise<Map<string, string>> {
  if (legacyFilesPromise) return legacyFilesPromise;
  legacyFilesPromise = (async () => {
    const map = new Map<string, string>();
    for (const directory of legacyCacheDirectories()) {
      try {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && /^img_[0-9a-f]{12}\./i.test(entry.name)) {
            map.set(entry.name.toLowerCase(), resolve(directory, entry.name));
          }
        }
      } catch {
        // The legacy cache is optional. Missing files fall back to HTTP.
      }
    }
    return map;
  })();
  return legacyFilesPromise;
}

async function validatePublicImageUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('فقط لینک HTTP یا HTTPS مجاز است');
  if (url.username || url.password) throw new Error('لینک دارای نام کاربری یا رمز عبور مجاز نیست');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('آدرس داخلی مجاز نیست');
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('آدرس داخلی یا رزروشده مجاز نیست');
  }
  return url;
}

async function fetchPublicImage(value: string): Promise<Response> {
  let url = await validatePublicImageUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TamasMarket-ImageMirror/1.0)',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('پاسخ تغییر مسیر معتبر نیست');
    url = await validatePublicImageUrl(new URL(location, url).toString());
  }
  throw new Error('تعداد تغییر مسیرهای تصویر بیش از حد مجاز است');
}

function normalizeMimeType(value: string | null, filename: string): string {
  const raw = (value ?? '').split(';')[0]!.trim().toLowerCase();
  if (raw === 'image/jpg' || raw === 'image/pjpeg') return 'image/jpeg';
  if (raw === 'image/x-png') return 'image/png';
  if (IMAGE_MIME_TYPES.has(raw)) return raw;
  const ext = extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  throw new Error('نوع فایل دریافتی تصویر نیست');
}

async function readLimitedBuffer(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > env.UPLOAD_MAX_BYTES) throw new Error('حجم تصویر بیش از حد مجاز است');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > env.UPLOAD_MAX_BYTES) {
      await reader.cancel();
      throw new Error('حجم تصویر بیش از حد مجاز است');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

async function legacyFileForSource(source: string): Promise<string | null> {
  const files = await loadLegacyFiles();
  const direct = legacyImageFilename(source);
  if (direct) return files.get(direct.toLowerCase()) ?? null;
  if (!isRemoteImageUrl(source)) return null;
  const stem = legacyCacheStemForUrl(source);
  const found = [...files.entries()].find(([name]) => name.startsWith(`${stem.toLowerCase()}.`));
  return found?.[1] ?? null;
}

async function readImageSource(source: string, useLegacyCache = true): Promise<{ buffer: Buffer; filename: string; mimeType: string; fromLegacyCache: boolean }> {
  const legacyPath = useLegacyCache ? await legacyFileForSource(source) : null;
  if (legacyPath) {
    const filename = basename(legacyPath);
    return { buffer: await readFile(legacyPath), filename, mimeType: normalizeMimeType(null, filename), fromLegacyCache: true };
  }
  if (!isRemoteImageUrl(source)) throw new Error('فایل محلی قدیمی روی دیسک پیدا نشد');
  const response = await fetchPublicImage(source);
  if (!response.ok) throw new Error(`دریافت تصویر با خطای HTTP ${response.status} روبه‌رو شد`);
  const filename = basename(new URL(response.url || source).pathname) || 'product-image';
  return {
    buffer: await readLimitedBuffer(response),
    filename,
    mimeType: normalizeMimeType(response.headers.get('content-type'), filename),
    fromLegacyCache: false,
  };
}

function needsDownload(value: string | null | undefined): boolean {
  const clean = String(value ?? '').trim();
  if (!clean || clean.startsWith('data:')) return false;
  if (isStoredImageUrl(clean, env.STORAGE_PUBLIC_URL)) return false;
  return isRemoteImageUrl(clean) || Boolean(legacyImageFilename(clean));
}

function needsImageWork(value: string | null | undefined): boolean {
  const clean = String(value ?? '').trim();
  if (!clean || clean.startsWith('data:')) return false;
  return needsDownload(clean) || (!clean.startsWith('/') && !isStoredImageUrl(clean, env.STORAGE_PUBLIC_URL));
}

function hasPendingImages(row: { imageUrl: string | null; gallery: string[] }): boolean {
  return needsImageWork(row.imageUrl) || row.gallery.some(needsImageWork);
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await fn(items[index]!);
    }
  }));
}

export function isProductImageMirrorRunning(): boolean {
  return running;
}

export async function mirrorProductImages(options: { limit?: number; concurrency?: number } = {}): Promise<ProductImageMirrorReport> {
  if (running) throw new Error('محلی‌سازی تصاویر هم‌اکنون در حال اجراست');
  running = true;
  try {
    const limit = Math.max(1, Math.min(options.limit ?? env.PRODUCT_IMAGE_MIRROR_BATCH_SIZE, 1000));
    const concurrency = Math.max(1, Math.min(options.concurrency ?? env.PRODUCT_IMAGE_MIRROR_CONCURRENCY, 8));
    const rows = await db
      .select({ id: products.id, productId: products.productId, imageUrl: products.imageUrl, gallery: products.gallery })
      .from(products)
      .where(and(isNull(products.deletedAt)));
    const pending = rows.filter(hasPendingImages);
    const targets = pending.slice(0, limit);
    const failures: ProductImageMirrorFailure[] = [];
    const sourceCache = new Map<string, Promise<string>>();
    let localizedImages = 0;
    let normalizedLocalImages = 0;
    let processedProducts = 0;
    let resolvedProducts = 0;

    const localize = async (source: string, productId: string): Promise<string> => {
      const clean = source.trim();
      let task = sourceCache.get(clean);
      if (!task) {
        task = (async () => {
          if (!needsDownload(clean)) {
            const normalized = normalizeStoredImageUrl(clean, env.STORAGE_PUBLIC_URL);
            if (normalized !== clean) normalizedLocalImages += 1;
            return normalized;
          }
          const input = await readImageSource(clean);
          let uploaded;
          try {
            uploaded = await processUpload({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType, kind: 'product', uploadedBy: null });
          } catch (error) {
            if (!input.fromLegacyCache || !isRemoteImageUrl(clean)) throw error;
            const remoteInput = await readImageSource(clean, false);
            uploaded = await processUpload({ buffer: remoteInput.buffer, filename: remoteInput.filename, mimeType: remoteInput.mimeType, kind: 'product', uploadedBy: null });
          }
          localizedImages += 1;
          return uploaded.url;
        })();
        sourceCache.set(clean, task);
      }
      try {
        return await task;
      } catch (error) {
        failures.push({ productId, url: clean, error: error instanceof Error ? error.message : 'خطای نامشخص' });
        return clean;
      }
    };

    await mapWithConcurrency(targets, concurrency, async (row) => {
      const nextMain = row.imageUrl ? await localize(row.imageUrl, row.productId) : null;
      const nextGallery = await Promise.all(row.gallery.map((url) => localize(url, row.productId)));
      if (nextMain !== row.imageUrl || nextGallery.some((url, index) => url !== row.gallery[index])) {
        await db.update(products).set({ imageUrl: nextMain, gallery: nextGallery, updatedAt: new Date() }).where(eq(products.id, row.id));
        processedProducts += 1;
      }
      if (!hasPendingImages({ imageUrl: nextMain, gallery: nextGallery })) resolvedProducts += 1;
    });

    if (processedProducts > 0) invalidateCatalog();
    const remainingProducts = pending.length - resolvedProducts;

    return {
      scannedProducts: rows.length,
      processedProducts,
      localizedImages,
      normalizedLocalImages,
      failedImages: failures.length,
      remainingProducts: Math.max(0, remainingProducts),
      failures: failures.slice(0, 100),
    };
  } finally {
    running = false;
  }
}

