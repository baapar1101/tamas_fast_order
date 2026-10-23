import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { env } from '../env.js';
import { confinedFilePath } from '../lib/private-files.js';

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

export async function putPrivateFile(key: string, buffer: Buffer): Promise<{ size: number; checksum: string }> {
  await ensurePrivateStorage();
  const path = confinedFilePath(privateStorageRoot, key);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, buffer, { mode: 0o600, flag: 'wx' });
  return { size: buffer.length, checksum: createHash('sha256').update(buffer).digest('hex') };
}

export async function openPrivateFile(key: string) {
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
