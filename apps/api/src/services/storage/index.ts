import crypto from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { env } from '../../env.js';

export interface StorageAdapter {
  localRoot?(): string;
  publicUrl(key: string): string;
  put(key: string, buffer: Buffer, mimeType: string): Promise<{ size: number; checksum: string }>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements StorageAdapter {
  localRoot(): string {
    return resolve(env.STORAGE_ROOT);
  }

  publicUrl(key: string): string {
    return `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
  }

  async put(key: string, buffer: Buffer, mimeType: string) {
    const fullPath = join(env.STORAGE_ROOT, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    return { size: buffer.byteLength, checksum };
  }

  async delete(key: string) {
    const fullPath = join(env.STORAGE_ROOT, key);
    await rm(fullPath, { force: true }).catch(() => {});
  }
}

export const storage = new LocalStorage();
