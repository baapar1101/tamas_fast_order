import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { env } from '../../env.js';
import { privateStorageRoot, PRIVATE_OBJECT_PREFIX } from '../private-storage.js';
import { bucket, contentTypeFor, storage } from './index.js';

export interface StorageSyncReport {
  scanned: number;
  uploaded: number;
  alreadyThere: number;
  failed: Array<{ key: string; error: string }>;
}

async function walk(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'));
    }
  };
  await visit(root);
  return files;
}

let running: Promise<StorageSyncReport> | null = null;

/**
 * Copies every file still only on the local disk into the bucket: public
 * uploads under their own key, private documents under `private/`. Files
 * already in the bucket are skipped, so it is safe to run on every start;
 * nothing on disk is deleted.
 */
export function syncLocalFilesToBucket(log: (message: string) => void = console.info): Promise<StorageSyncReport> {
  running ??= (async () => {
    const target = bucket();
    const report: StorageSyncReport = { scanned: 0, uploaded: 0, alreadyThere: 0, failed: [] };
    if (!target) return report;
    const existing = await target.listKeys();
    const publicFiles = (await walk(storage.localRoot()))
      .filter((key) => !key.startsWith('backups/'))
      .map((key) => ({ key, path: join(storage.localRoot(), key) }));
    const privateFiles = (await walk(privateStorageRoot))
      .map((key) => ({ key: `${PRIVATE_OBJECT_PREFIX}${key}`, path: join(privateStorageRoot, key) }));
    const all = [...publicFiles, ...privateFiles];
    report.scanned = all.length;
    const pending = all.filter((file) => {
      if (existing.has(file.key)) {
        report.alreadyThere += 1;
        return false;
      }
      return true;
    });
    if (pending.length) log(`[storage] copying ${pending.length} local files to bucket ${target.name}…`);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (next < pending.length) {
        const file = pending[next++]!;
        try {
          await target.put(file.key, await readFile(file.path), contentTypeFor(file.key));
          report.uploaded += 1;
          if (report.uploaded % 200 === 0) log(`[storage] copied ${report.uploaded}/${pending.length}`);
        } catch (error) {
          report.failed.push({ key: file.key, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }));
    log(`[storage] bucket sync done: ${report.uploaded} copied, ${report.alreadyThere} already there, ${report.failed.length} failed (of ${report.scanned}).`);
    for (const failure of report.failed.slice(0, 10)) log(`[storage]   failed ${failure.key}: ${failure.error}`);
    return report;
  })().finally(() => { running = null; });
  return running;
}

/** On start with the s3 driver: copy in the background, never blocking requests. */
export function startBucketSyncOnBoot(log: (message: string) => void): void {
  if (storage.driver !== 's3' || !env.S3_SYNC_ON_START) return;
  setTimeout(() => {
    syncLocalFilesToBucket(log).catch((error) => log(`[storage] bucket sync failed: ${error instanceof Error ? error.message : String(error)}`));
  }, 5_000).unref();
}
