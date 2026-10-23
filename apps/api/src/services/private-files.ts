import { eq, or } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { env } from '../env.js';
import { badRequest } from '../lib/errors.js';
import { privateFileId, privateFileUrl, type PrivateFileScope } from '../lib/private-files.js';

export async function findPrivateFile(id: number) {
  const [file] = await db.select().from(schema.uploads).where(eq(schema.uploads.id, id)).limit(1);
  return file?.privateScope ? file : null;
}

export function localUploadKey(value: string): string | null {
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.origin !== new URL(env.PUBLIC_SITE_URL).origin) return null;
    path = url.pathname;
  }
  const prefix = `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/`;
  if (!path.startsWith(prefix)) return null;
  try { return decodeURIComponent(path.slice(prefix.length).split('?')[0]!); } catch { return null; }
}

export async function findUploadByKey(key: string) {
  const [file] = await db.select().from(schema.uploads)
    .where(or(eq(schema.uploads.storageKey, key), eq(schema.uploads.thumbKey, key))).limit(1);
  return file ?? null;
}

/** A customer cannot attach another account's document or an arbitrary URL. */
export async function claimPrivateFile(value: string, ownerId: number, scope: PrivateFileScope): Promise<string> {
  const id = privateFileId(value);
  const key = id === null ? localUploadKey(value) : null;
  const file = id === null ? (key ? await findUploadByKey(key) : null) : await findPrivateFile(id);
  if (!file?.privateScope || (file.privateOwnerId ?? file.uploadedBy) !== ownerId) {
    throw badRequest('فایل باید از حساب خودتان و از بخش بارگذاری مدارک ارسال شده باشد.');
  }
  // Never downgrade a credit document to the broader order-operator scope.
  if (scope === 'credit' && file.privateScope !== 'credit') {
    await db.update(schema.uploads).set({ privateScope: 'credit' }).where(eq(schema.uploads.id, file.id));
  }
  return privateFileUrl(file.id);
}
