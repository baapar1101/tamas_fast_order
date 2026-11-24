import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { env } from '../env.js';
import { confinedFilePath } from '../lib/private-files.js';
import { bucket, contentTypeFor, safeStorageKey } from './storage/index.js';

export const privateStorageRoot = resolve(env.PRIVATE_STORAGE_ROOT || resolve(env.STORAGE_ROOT, '../private-storage'));

export async function ensurePrivateStorage(): Promise<void> {
  for (const publicRoot of [resolve(env.STORAGE_ROOT), resolve('../web/public'), resolve('../web/dist')]) {
    const suffix = relative(publicRoot, privateStorageRoot);
    if (!suffix || (!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..${sep}`))) {
      throw new Error('PRIVATE_STORAGE_ROOT must be outside all public roots');
    }
  }
  await mkdir(privateStorageRoot, { recursive: true, mode: 0o700 });
  await chmod(privateStorageRoot, 0o700);
}

/** Private documents sit under this prefix in the (private) bucket. */
export const PRIVATE_OBJECT_PREFIX = 'private/';

function privateObjectKey(key: string): string {
  const safe = safeStorageKey(key);
  if (!safe) throw new Error('Invalid private file path');
  return `${PRIVATE_OBJECT_PREFIX}${safe}`;
}

export async function putPrivateFile(key: string, buffer: Buffer): Promise<{ size: number; checksum: string }> {
  const checksum = createHash('sha256').update(buffer).digest('hex');
  const target = bucket();
  if (target) {
    const objectKey = privateObjectKey(key);
    // Same rule as the disk's 'wx': never overwrite an existing document.
    if (await target.exists(objectKey)) throw new Error('Private file already exists');
    await target.put(objectKey, buffer, contentTypeFor(key));
    return { size: buffer.length, checksum };
  }
  await ensurePrivateStorage();
  const path = confinedFilePath(privateStorageRoot, key);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, buffer, { mode: 0o600, flag: 'wx' });
  return { size: buffer.length, checksum };
}

export async function openPrivateFile(key: string) {
  const target = bucket();
  if (target) {
    const object = await target.get(privateObjectKey(key));
    if (object) return { stream: object.stream, size: object.size };
    // Not copied to the bucket yet: fall back to the disk below.
  }
  return openPrivateFileOnDisk(key);
}

async function openPrivateFileOnDisk(key: string) {
  const path = await realpath(confinedFilePath(privateStorageRoot, key));
  // Disallow symlinks pointing outside the private root as well as traversal.
  const root = await realpath(privateStorageRoot);
  const suffix = relative(root, path);
  if (!suffix || isAbsolute(suffix) || suffix === '..' || suffix.startsWith(`..${sep}`)) throw new Error('Invalid private file path');
  const metadata = await stat(path);
  if (!metadata.isFile()) throw new Error('Not a document');
  return { stream: createReadStream(path), size: metadata.size };
}

/** No streams or file contents are opened by the document-health inventory. */
export async function inspectPrivateFile(key: string): Promise<'available' | 'missing' | 'unavailable'> {
  const target = bucket();
  if (target) {
    try {
      if (await target.exists(privateObjectKey(key))) return 'available';
    } catch {
      return 'unavailable';
    }
  }
  try {
    const root = await realpath(privateStorageRoot);
    const path = await realpath(confinedFilePath(privateStorageRoot, key));
    const suffix = relative(root, path);
    if (!suffix || isAbsolute(suffix) || suffix === '..' || suffix.startsWith(`..${sep}`)) return 'unavailable';
    return (await stat(path)).isFile() ? 'available' : 'unavailable';
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unavailable';
  }
}
