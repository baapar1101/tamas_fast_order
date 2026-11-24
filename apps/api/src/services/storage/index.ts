import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../../env.js';
import { S3Bucket } from './s3.js';

export interface StoredObject {
  stream: Readable;
  size: number;
  contentType: string;
  etag?: string;
  lastModified?: Date;
}

export interface StorageAdapter {
  readonly driver: 'local' | 's3';
  /** The disk folder the files live in (local driver), or the folder still read as a fallback (s3). */
  localRoot(): string;
  publicUrl(key: string): string;
  put(key: string, buffer: Buffer, mimeType: string): Promise<{ size: number; checksum: string }>;
  get(key: string): Promise<StoredObject | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  json: 'application/json',
};

export function contentTypeFor(key: string): string {
  return CONTENT_TYPES[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

/** Keys never leave their root: no traversal, no backslashes, no absolute paths. */
export function safeStorageKey(key: string): string | null {
  const clean = key.replace(/^\/+/, '');
  if (!clean || clean.includes('..') || clean.includes('\\') || clean.includes('\0')) return null;
  return clean;
}

async function readLocal(root: string, key: string): Promise<StoredObject | null> {
  const safe = safeStorageKey(key);
  if (!safe) return null;
  const path = join(root, safe);
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return { stream: createReadStream(path), size: info.size, contentType: contentTypeFor(safe), lastModified: info.mtime };
  } catch {
    return null;
  }
}

async function localExists(root: string, key: string): Promise<boolean> {
  const safe = safeStorageKey(key);
  if (!safe) return false;
  return stat(join(root, safe)).then((info) => info.isFile() && info.size > 0, () => false);
}

class LocalStorage implements StorageAdapter {
  readonly driver = 'local' as const;

  localRoot(): string {
    return resolve(env.STORAGE_ROOT);
  }

  publicUrl(key: string): string {
    return `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
  }

  async put(key: string, buffer: Buffer, _mimeType: string) {
    const fullPath = join(env.STORAGE_ROOT, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    return { size: buffer.byteLength, checksum };
  }

  get(key: string) {
    return readLocal(this.localRoot(), key);
  }

  exists(key: string) {
    return localExists(this.localRoot(), key);
  }

  async delete(key: string) {
    const fullPath = join(env.STORAGE_ROOT, key);
    await rm(fullPath, { force: true }).catch(() => {});
  }
}

/**
 * Object storage. New files go only to the bucket; reads fall back to the old
 * disk folder, so files not yet copied over keep working during the move.
 */
class S3Storage implements StorageAdapter {
  readonly driver = 's3' as const;

  constructor(private readonly bucket: S3Bucket) {}

  localRoot(): string {
    return resolve(env.STORAGE_ROOT);
  }

  publicUrl(key: string): string {
    return `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
  }

  async put(key: string, buffer: Buffer, mimeType: string) {
    const safe = safeStorageKey(key);
    if (!safe) throw new Error('Invalid storage key');
    await this.bucket.put(safe, buffer, mimeType || contentTypeFor(safe));
    return { size: buffer.byteLength, checksum: crypto.createHash('sha256').update(buffer).digest('hex') };
  }

  async get(key: string) {
    const safe = safeStorageKey(key);
    if (!safe) return null;
    return (await this.bucket.get(safe)) ?? readLocal(this.localRoot(), safe);
  }

  async exists(key: string) {
    const safe = safeStorageKey(key);
    if (!safe) return false;
    return (await this.bucket.exists(safe)) || localExists(this.localRoot(), safe);
  }

  async delete(key: string) {
    const safe = safeStorageKey(key);
    if (!safe) return;
    await this.bucket.delete(safe).catch(() => {});
    await rm(join(env.STORAGE_ROOT, safe), { force: true }).catch(() => {});
  }
}

export function s3Configured(): boolean {
  return Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

function createStorage(): StorageAdapter {
  if (env.STORAGE_DRIVER !== 's3') return new LocalStorage();
  if (!s3Configured()) {
    throw new Error('STORAGE_DRIVER=s3 needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.');
  }
  return new S3Storage(bucket()!);
}

let sharedBucket: S3Bucket | null = null;
/** The configured bucket (s3 driver only). */
export function bucket(): S3Bucket | null {
  if (env.STORAGE_DRIVER !== 's3' || !s3Configured()) return null;
  sharedBucket ??= new S3Bucket({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });
  return sharedBucket;
}

export const storage: StorageAdapter = createStorage();
