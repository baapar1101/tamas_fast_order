import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDb, sql } from '../src/db/client.js';
import { env } from '../src/env.js';
import { confinedFilePath, privateFileUrl } from '../src/lib/private-files.js';
import { privateStorageRoot } from '../src/services/private-storage.js';

async function main() {
  const allowedMissing = new Set((process.argv.find((item) => item.startsWith('--allow-missing='))?.split('=')[1] ?? '').split(',').map(Number));
  const unavailable = new Set<number>();
  const files = await sql`select id,storage_key,thumb_key from uploads where private_scope is not null`;
  let verified = 0;
  for (const file of files) {
    for (const key of [file.storage_key, file.thumb_key].filter(Boolean) as string[]) {
      const exists = await stat(confinedFilePath(privateStorageRoot, key)).then((item) => item.isFile()).catch(() => false);
      if (!exists && allowedMissing.has(Number(file.id))) unavailable.add(Number(file.id));
      else assert.equal(exists, true, 'A migrated private file is missing');
      assert.equal(await stat(confinedFilePath(resolve(env.STORAGE_ROOT), key)).then(() => true).catch(() => false), false, 'Private original still exists in public storage');
      const oldUrl = `${env.PUBLIC_SITE_URL}${env.STORAGE_PUBLIC_URL}/${key}`;
      const legacy = await fetch(oldUrl, { redirect: 'manual' });
      assert.equal(legacy.status, 404, 'Legacy public URL must not expose documents');
      assert.match(legacy.headers.get('cache-control') ?? '', /no-store/);
      await legacy.body?.cancel();
      verified += 1;
    }
    const response = await fetch(`${env.PUBLIC_SITE_URL}${privateFileUrl(Number(file.id))}`);
    assert.equal(response.status, 401, 'A document requires authentication');
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    await response.body?.cancel();
  }
  const photos = await sql`select storage_key from uploads where private_scope is null and kind='product' order by id desc limit 3`;
  for (const photo of photos) {
    const response = await fetch(`${env.PUBLIC_SITE_URL}${env.STORAGE_PUBLIC_URL}/${photo.storage_key}`);
    assert.equal(response.status, 200, 'Public product photo regression');
    await response.body?.cancel();
  }
  console.log(JSON.stringify({ documents: files.length, legacyFilesBlocked: verified, preexistingMissingUploads: [...unavailable], publicPhotos: photos.length, ok: true }));
}
main().then(closeDb).catch(async (error) => { console.error(error.message); await closeDb(); process.exitCode = 1; });
