import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { env } from '../../env.js';

export interface StorageDriver {
  localRoot(): string | null;
  publicUrl(key: string): string;
  put(key: string, body: Buffer, mimeType: string): Promise<{ key: string; size: number; checksum: string }>;
  delete(key: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  localRoot(): string | null {
    return env.STORAGE_DRIVER === 'local' ? join(process.cwd(), env.STORAGE_ROOT) : null;
  }

  publicUrl(key: string): string {
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }
    const prefix = env.STORAGE_PUBLIC_URL.replace(/\/$/, '');
    const cleanKey = key.replace(/^\//, '');
    return `${prefix}/${cleanKey}`;
  }

  async put(key: string, body: Buffer, _mimeType: string): Promise<{ key: string; size: number; checksum: string }> {
    const fullPath = join(env.STORAGE_ROOT, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, body);

    const checksum = `sha256:${createHash('sha256').update(body).digest('hex')}`;
    return {
      key,
      size: body.byteLength,
      checksum,
    };
  }

  async delete(key: string): Promise<void> {
    const fullPath = join(env.STORAGE_ROOT, key);
    try {
      await unlink(fullPath);
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}

export const storage: StorageDriver = new LocalStorageDriver();
