/** Import one image per SKU from a local server directory. Dry-run unless --apply is set. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { eq, isNull } from 'drizzle-orm';
import sharp from 'sharp';
import { closeDb, db } from '../src/db/client.js';
import { products } from '../src/db/schema.js';
import { matchProductImageSku } from '../src/lib/product-image-sku.js';
import { invalidateCatalog } from '../src/services/catalog.js';
import { enqueueCrmProductSync } from '../src/services/crm-product-sync.js';
import { storage } from '../src/services/storage/index.js';
import { processUpload } from '../src/services/uploads.js';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
};

const directoryArg = process.argv.find((arg) => arg.startsWith('--dir='))?.slice('--dir='.length);
const apply = process.argv.includes('--apply');
if (!directoryArg) throw new Error('مسیر پوشه را با --dir=PATH مشخص کنید.');
const directory = resolve(directoryArg);

try {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  if (files.length === 0) throw new Error('پوشهٔ تصاویر خالی است.');
  const unsupported = files.filter((entry) => !MIME_TYPES[extname(entry.name).toLowerCase()]);
  if (unsupported.length > 0) throw new Error(`فرمت فایل پشتیبانی نمی‌شود: ${unsupported.map((entry) => entry.name).join(', ')}`);

  const rows = await db.select({
    id: products.id,
    productId: products.productId,
    sku: products.sku,
    title: products.title,
    imageUrl: products.imageUrl,
    gallery: products.gallery,
  }).from(products).where(isNull(products.deletedAt));

  const plan = [];
  const seenProducts = new Set<number>();
  for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
    const stem = basename(file.name, extname(file.name));
    const product = matchProductImageSku(stem, rows);
    if (seenProducts.has(product.id)) throw new Error(`چند فایل برای کد ${product.productId} پیدا شد.`);
    seenProducts.add(product.id);

    const buffer = await readFile(resolve(directory, file.name));
    const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`تصویر ${file.name} قابل خواندن نیست.`);
    plan.push({
      file: file.name,
      product,
      mimeType: MIME_TYPES[extname(file.name).toLowerCase()]!,
      bytes: buffer.byteLength,
      width: metadata.width,
      height: metadata.height,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    });
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    directory,
    matches: plan.map(({ file, product, bytes, width, height, sha256 }) => ({
      file, productId: product.productId, title: product.title, previousImageUrl: product.imageUrl,
      bytes, width, height, sha256,
    })),
  }, null, 2));

  if (apply) {
    const root = storage.localRoot?.();
    if (!root) throw new Error('پشتیبان‌گیری برای این نوع ذخیره‌سازی پشتیبانی نمی‌شود.');
    const backupDir = resolve(root, 'backups');
    await mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = resolve(backupDir, `sku-product-images-${timestamp}.json`);
    await writeFile(backupPath, JSON.stringify({
      createdAt: new Date().toISOString(),
      products: plan.map(({ file, product, sha256 }) => ({
        file, sha256, id: product.id, productId: product.productId,
        previousImageUrl: product.imageUrl, previousGallery: product.gallery,
      })),
    }, null, 2), 'utf8');
    console.log(JSON.stringify({ backupPath }));

    const failures: Array<{ file: string; error: string }> = [];
    for (const { file, product, mimeType } of plan) {
      try {
        const uploaded = await processUpload({
          buffer: await readFile(resolve(directory, file)),
          filename: file,
          mimeType,
          kind: 'product',
          uploadedBy: null,
        });
        await db.update(products).set({ imageUrl: uploaded.url, updatedAt: new Date() }).where(eq(products.id, product.id));
        await enqueueCrmProductSync(product.productId, 'update');
        invalidateCatalog();
        console.log(JSON.stringify({ updated: product.productId, imageUrl: uploaded.url }));
      } catch (error) {
        failures.push({ file, error: error instanceof Error ? error.message : String(error) });
      }
    }
    console.log(JSON.stringify({ updatedProducts: plan.length - failures.length, failedProducts: failures.length, failures }));
    if (failures.length > 0) process.exitCode = 1;
  }
} finally {
  await closeDb();
}
