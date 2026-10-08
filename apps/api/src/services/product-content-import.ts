import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products } from '../db/schema.js';
import { env } from '../env.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import { sanitizeExternalText } from '../lib/external-content.js';
import { invalidateCatalog } from './catalog.js';
import { processUpload } from './uploads.js';

const API_HOST = 'api.digikala.com';
const IMAGE_HOST = 'dkstatics-public.digikala.com';
const MAX_IMAGES = 12;
const REQUEST_TIMEOUT_MS = 20_000;

type JsonRecord = Record<string, unknown>;

export interface ImportedProductContent {
  imageUrl: string | null;
  gallery: string[];
  description: string | null;
  attributes: Array<{ key: string; value: string }>;
  /** Hundredths on a 0–5 scale. */
  rating: number | null;
  ratingCount: number;
}

export interface ProductContentImportResult {
  id: number;
  productId: string;
  title: string;
  imageCount: number;
  attributeCount: number;
  rating: number | null;
  updatedAt: string;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const found = value.find((item) => typeof item === 'string' && item.trim());
  return typeof found === 'string' ? found.trim() : null;
}

export function extractExternalProductId(link: string): string {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw badRequest('لینک ثبت‌شده برای محصول معتبر نیست.');
  }

  const host = url.hostname.toLowerCase();
  if (host !== 'digikala.com' && !host.endsWith('.digikala.com')) {
    throw badRequest('دامنه لینک ثبت‌شده معتبر نیست.');
  }

  const match = url.pathname.match(/\/products?\/(?:dkp-)?(\d+)(?:\/|$)/i);
  if (!match?.[1]) throw badRequest('شناسه محصول از لینک ثبت‌شده قابل تشخیص نیست.');
  return match[1];
}

function readImageUrls(product: JsonRecord): string[] {
  const images = asRecord(product.images);
  const main = asRecord(images.main);
  const list = Array.isArray(images.list) ? images.list : [];
  const candidates = [
    firstUrl(main.webp_url) ?? firstUrl(main.url),
    ...list.map((item) => {
      const row = asRecord(item);
      return firstUrl(row.webp_url) ?? firstUrl(row.url);
    }),
  ];

  return [...new Set(candidates.filter((url): url is string => Boolean(url)))].slice(0, MAX_IMAGES);
}

function readAttributes(product: JsonRecord): Array<{ key: string; value: string }> {
  const groups = Array.isArray(product.specifications) ? product.specifications : [];
  const result: Array<{ key: string; value: string }> = [];

  for (const groupValue of groups) {
    const group = asRecord(groupValue);
    const groupTitle = sanitizeExternalText(asText(group.title));
    const attributes = Array.isArray(group.attributes) ? group.attributes : [];
    for (const attributeValue of attributes) {
      const attribute = asRecord(attributeValue);
      const title = sanitizeExternalText(asText(attribute.title));
      const values = Array.isArray(attribute.values)
        ? attribute.values.map(asText).filter(Boolean)
        : [];
      if (!title || values.length === 0) continue;
      const value = sanitizeExternalText(values.join('، ')).slice(0, 2000);
      if (!value) continue;
      result.push({
        key: groupTitle ? `${groupTitle} — ${title}`.slice(0, 120) : title.slice(0, 120),
        value,
      });
      if (result.length >= 60) return result;
    }
  }
  return result;
}

export function parseProductContentPayload(payload: unknown): Omit<ImportedProductContent, 'imageUrl' | 'gallery'> & { imageUrls: string[] } {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const product = asRecord(data.product);
  if (Object.keys(product).length === 0) throw new AppError('پاسخ سرویس اطلاعات محصول معتبر نبود.', 502, 'upstream_error');

  const review = asRecord(product.review);
  const expertReview = asRecord(product.expert_reviews);
  const rawDescription = asText(review.description)
    || asText(expertReview.description)
    || asText(review.short_review)
    || asText(expertReview.short_review);
  const description = sanitizeExternalText(rawDescription) || null;
  const ratingData = asRecord(product.rating);
  const rate = Number(ratingData.rate);
  const count = Number(ratingData.count);

  return {
    imageUrls: readImageUrls(product),
    description,
    attributes: readAttributes(product),
    rating: Number.isFinite(rate) && rate >= 0 && rate <= 100 ? Math.round((rate / 20) * 100) : null,
    ratingCount: Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0,
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json,image/avif,image/webp,image/*,*/*;q=0.8', 'user-agent': 'TamasMarket-ContentImporter/1.0' },
      redirect: 'error',
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new AppError('دریافت اطلاعات محصول بیش از حد طول کشید.', 504, 'upstream_timeout');
    throw new AppError('ارتباط با سرویس اطلاعات محصول برقرار نشد.', 502, 'upstream_error');
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchProductPayload(externalId: string): Promise<unknown> {
  const url = `https://${API_HOST}/product/v1/products/${externalId}/`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new AppError(`دریافت اطلاعات محصول با خطای ${response.status} روبه‌رو شد.`, 502, 'upstream_error');
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > 5 * 1024 * 1024) throw new AppError('حجم پاسخ اطلاعات محصول بیش از حد مجاز است.', 502, 'upstream_error');
  return response.json().catch(() => { throw new AppError('پاسخ سرویس اطلاعات محصول قابل خواندن نبود.', 502, 'upstream_error'); });
}

async function downloadImage(urlString: string, externalId: string, index: number, uploadedBy: number | null): Promise<string> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new AppError('یکی از آدرس‌های تصویر نامعتبر بود.', 502, 'upstream_error');
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== IMAGE_HOST) {
    throw new AppError('دامنه یکی از تصاویر معتبر نیست.', 502, 'upstream_error');
  }

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) throw new AppError(`دریافت تصویر ${index + 1} ناموفق بود.`, 502, 'upstream_error');
  const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!mimeType.startsWith('image/')) throw new AppError('فایل دریافت‌شده تصویر نیست.', 502, 'upstream_error');
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > env.UPLOAD_MAX_BYTES) throw badRequest(`حجم تصویر ${index + 1} بیش از حد مجاز است.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > env.UPLOAD_MAX_BYTES) throw badRequest(`حجم تصویر ${index + 1} بیش از حد مجاز است.`);

  const uploaded = await processUpload({
    buffer,
    filename: `product-${externalId}-${index + 1}.webp`,
    mimeType,
    kind: 'product',
    uploadedBy,
  });
  return uploaded.url;
}

async function prepareContent(link: string, uploadedBy: number | null): Promise<ImportedProductContent> {
  const externalId = extractExternalProductId(link);
  const parsed = parseProductContentPayload(await fetchProductPayload(externalId));
  const localImages: string[] = [];
  for (let index = 0; index < parsed.imageUrls.length; index += 1) {
    localImages.push(await downloadImage(parsed.imageUrls[index]!, externalId, index, uploadedBy));
  }
  return {
    imageUrl: localImages[0] ?? null,
    gallery: localImages.slice(1),
    description: parsed.description,
    attributes: parsed.attributes,
    rating: parsed.rating,
    ratingCount: parsed.ratingCount,
  };
}

export async function importProductContent(productDbId: number, uploadedBy: number): Promise<ProductContentImportResult> {
  const [product] = await db.select().from(products).where(eq(products.id, productDbId)).limit(1);
  if (!product || product.deletedAt) throw notFound('محصول پیدا نشد.');
  if (!product.digikalaLink?.trim()) throw badRequest('برای این محصول لینک منبع ثبت نشده است.');

  const content = await prepareContent(product.digikalaLink, uploadedBy);
  const now = new Date();
  const [updated] = await db.update(products).set({ ...content, externalDataUpdatedAt: now, updatedAt: now }).where(eq(products.id, product.id)).returning();
  if (!updated) throw notFound('محصول پیدا نشد.');
  invalidateCatalog();
  return {
    id: updated.id,
    productId: updated.productId,
    title: updated.title,
    imageCount: (updated.imageUrl ? 1 : 0) + updated.gallery.length,
    attributeCount: updated.attributes.length,
    rating: updated.rating,
    updatedAt: now.toISOString(),
  };
}

/** Restore missing image files from the product source without overwriting editorial or sales data. */
export async function restoreProductImages(productDbId: number): Promise<{ productId: string; imageCount: number }> {
  const [product] = await db.select().from(products).where(eq(products.id, productDbId)).limit(1);
  if (!product || product.deletedAt) throw notFound('محصول پیدا نشد.');
  if (!product.digikalaLink?.trim()) throw badRequest('برای این محصول لینک منبع ثبت نشده است.');

  const { imageUrl, gallery } = await prepareContent(product.digikalaLink, null);
  if (!imageUrl) throw new AppError('تصویری در منبع محصول پیدا نشد.', 502, 'upstream_error');

  await db.update(products).set({ imageUrl, gallery, updatedAt: new Date() }).where(eq(products.id, product.id));
  invalidateCatalog();
  return { productId: product.productId, imageCount: 1 + gallery.length };
}

