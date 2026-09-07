import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import type { UploadDTO, UploadKind } from '@tamas/shared';
import { db } from '../db/client.js';
import { uploads } from '../db/schema.js';
import { env } from '../env.js';
import { badRequest } from '../lib/errors.js';
import { storage } from './storage/index.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const DOC_TYPES = new Set(['application/pdf']);

/** Longest edge, per kind. Product shots stay big enough to zoom on hover. */
const MAX_EDGE: Record<UploadKind, number> = {
  product: 1400,
  brand: 512,
  category: 512,
  slide: 2000,
  certificate: 2400,
  other: 1600,
};

const THUMB_EDGE = 320;

export function toUploadDTO(row: typeof uploads.$inferSelect): UploadDTO {
  return {
    id: row.id,
    kind: row.kind,
    url: storage.publicUrl(row.storageKey),
    thumbUrl: row.thumbKey ? storage.publicUrl(row.thumbKey) : null,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
  };
}

interface ProcessInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  kind: UploadKind;
  uploadedBy: number | null;
}

/**
 * Images are re-encoded to WebP and given a thumbnail; anything else (a shop
 * licence PDF, say) is stored untouched. Re-encoding is what keeps the
 * storefront fast — the legacy catalogue linked full-size JPEGs straight from
 * the sheet.
 */
export async function processUpload(input: ProcessInput): Promise<UploadDTO> {
  const { buffer, filename, mimeType, kind, uploadedBy } = input;

  if (buffer.byteLength > env.UPLOAD_MAX_BYTES) {
    throw badRequest(`حجم فایل بیشتر از حد مجاز است (حداکثر ${Math.floor(env.UPLOAD_MAX_BYTES / 1024 / 1024)} مگابایت).`);
  }
  if (!IMAGE_TYPES.has(mimeType) && !DOC_TYPES.has(mimeType)) {
    throw badRequest('فقط تصویر (JPG, PNG, WebP, GIF, AVIF) یا PDF قابل آپلود است.');
  }

  const id = randomUUID();
  const folder = `${kind}/${new Date().toISOString().slice(0, 7)}`;

  if (DOC_TYPES.has(mimeType)) {
    const key = `${folder}/${id}${extname(filename) || '.pdf'}`;
    const stored = await storage.put(key, buffer, mimeType);
    const [row] = await db
      .insert(uploads)
      .values({
        kind,
        storageKey: key,
        originalName: filename.slice(0, 400),
        mimeType,
        size: stored.size,
        checksum: stored.checksum,
        uploadedBy,
      })
      .returning();
    if (!row) throw new Error('upload insert failed');
    return toUploadDTO(row);
  }

  // Animated GIFs lose their animation through the WebP pipeline unless we ask
  // for every frame, so pass `animated` through for them.
  const animated = mimeType === 'image/gif';
  const pipeline = sharp(buffer, { animated, failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();

  const main = await pipeline
    .clone()
    .resize({
      width: MAX_EDGE[kind],
      height: MAX_EDGE[kind],
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  const thumb = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toBuffer();

  const key = `${folder}/${id}.webp`;
  const thumbKey = `${folder}/${id}_thumb.webp`;
  const stored = await storage.put(key, main, 'image/webp');
  await storage.put(thumbKey, thumb, 'image/webp');

  const [row] = await db
    .insert(uploads)
    .values({
      kind,
      storageKey: key,
      thumbKey,
      originalName: filename.slice(0, 400),
      mimeType: 'image/webp',
      size: stored.size,
      width: meta.width ?? null,
      height: meta.height ?? null,
      checksum: stored.checksum,
      uploadedBy,
    })
    .returning();
  if (!row) throw new Error('upload insert failed');
  return toUploadDTO(row);
}

export async function deleteUpload(id: number): Promise<boolean> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
  if (!row) return false;
  await storage.delete(row.storageKey).catch(() => {});
  if (row.thumbKey) await storage.delete(row.thumbKey).catch(() => {});
  await db.delete(uploads).where(eq(uploads.id, id));
  return true;
}
