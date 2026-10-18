import { access, mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { isNull } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { products } from '../src/db/schema.js';
import { env } from '../src/env.js';
import { restoreProductImages } from '../src/services/product-content-import.js';
import { storage } from '../src/services/storage/index.js';

const apply = process.argv.includes('--apply');
const productId = process.argv.find((arg) => arg.startsWith('--product-id='))?.slice('--product-id='.length);
const root = storage.localRoot?.();
const publicPrefix = `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/`;

if (!root || !publicPrefix.startsWith('/')) {
  throw new Error('این ابزار فقط برای فایل‌های محلی با آدرس عمومیِ ریشه‌ای پشتیبانی می‌شود.');
}

async function isMissing(url: string): Promise<boolean> {
  if (!url.startsWith(publicPrefix)) return false;
  const path = resolve(root!, url.slice(publicPrefix.length));
  const child = relative(root!, path);
  if (child === '..' || child.startsWith('../') || child.startsWith('..\\')) {
    throw new Error('مسیر تصویر از پوشهٔ ذخیره‌سازی خارج است.');
  }
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

try {
  const rows = await db.select({
    id: products.id,
    productId: products.productId,
    digikalaLink: products.digikalaLink,
    imageUrl: products.imageUrl,
    gallery: products.gallery,
  }).from(products).where(isNull(products.deletedAt));

  const candidates: Array<{ id: number; productId: string; missingImages: number }> = [];
  for (const row of rows) {
    if (!row.digikalaLink || (productId && row.productId !== productId)) continue;
    let missingImages = 0;
    for (const url of [row.imageUrl, ...row.gallery]) {
      if (url && await isMissing(url)) missingImages += 1;
    }
    if (missingImages > 0) candidates.push({ id: row.id, productId: row.productId, missingImages });
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates }));
  if (productId && !rows.some((row) => row.productId === productId)) {
    throw new Error(`کد محصول ${productId} پیدا نشد.`);
  }

  if (apply) {
    if (candidates.length > 0) {
      const backupDir = resolve(root, 'backups');
      await mkdir(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = resolve(backupDir, `missing-product-images-${timestamp}.json`);
      const candidateIds = new Set(candidates.map((candidate) => candidate.id));
      const before = rows.filter((row) => candidateIds.has(row.id));
      await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), products: before }, null, 2), 'utf8');
      console.log(JSON.stringify({ backupPath }));
    }
    const failures: Array<{ productId: string; error: string }> = [];
    for (const candidate of candidates) {
      try {
        const result = await restoreProductImages(candidate.id);
        console.log(JSON.stringify({ restored: result.productId, imageCount: result.imageCount }));
      } catch (error) {
        failures.push({ productId: candidate.productId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    console.log(JSON.stringify({ restoredProducts: candidates.length - failures.length, failedProducts: failures.length, failures }));
    if (failures.length > 0) process.exitCode = 1;
  }
} finally {
  await closeDb();
}
