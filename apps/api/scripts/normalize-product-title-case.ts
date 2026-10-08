/** Normalize Latin casing in existing product titles. Read-only unless --apply is set. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { formatProductTitle } from '@tamas/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { brands, products } from '../src/db/schema.js';
import { buildSearchText } from '../src/services/catalog.js';
import { enqueueCrmProductSync } from '../src/services/crm-product-sync.js';
import { storage } from '../src/services/storage/index.js';

const apply = process.argv.includes('--apply');
const details = process.argv.includes('--details');
const expectedHash = process.argv.find((arg) => arg.startsWith('--plan-hash='))?.slice('--plan-hash='.length);

try {
  const [rows, brandRows] = await Promise.all([
    db.select().from(products).where(isNull(products.deletedAt)),
    db.select({ id: brands.id, name: brands.name }).from(brands),
  ]);
  const brandNameById = new Map(brandRows.map((brand) => [brand.id, brand.name]));
  const plan = rows.map((row) => ({ row, title: formatProductTitle(row.title) }))
    .filter(({ row, title }) => title !== row.title)
    .sort((a, b) => a.row.productId.localeCompare(b.row.productId));

  if (plan.some(({ title }) => !title.trim() || formatProductTitle(title) !== title)) {
    throw new Error('طرح شامل عنوان خالی یا تبدیل غیریکسان است.');
  }
  const summary = plan.map(({ row, title }) => ({
    productId: row.productId,
    oldTitle: row.title,
    title,
  }));
  const planHash = createHash('sha256').update(JSON.stringify(summary)).digest('hex');
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    totalActiveProducts: rows.length,
    changedProducts: plan.length,
    planHash,
    examples: summary.slice(0, 25),
    ...(details ? { changes: summary } : {}),
  }, null, 2));

  if (apply && plan.length > 0) {
    if (!expectedHash || expectedHash !== planHash) {
      throw new Error('برای اعمال تغییر، --plan-hash را مطابق پیش‌نمایش وارد کنید.');
    }
    const root = storage.localRoot?.();
    if (!root) throw new Error('مسیر امن برای پشتیبان‌گیری یافت نشد.');
    const backupDir = resolve(root, 'backups');
    await mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = resolve(backupDir, `product-title-case-${timestamp}.json`);
    await writeFile(backupPath, JSON.stringify({
      createdAt: new Date().toISOString(),
      planHash,
      products: plan.map(({ row, title }) => ({
        id: row.id, productId: row.productId, oldTitle: row.title, title,
        oldSearchText: row.searchText, oldUpdatedAt: row.updatedAt,
      })),
    }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ backupPath }));

    await db.transaction(async (tx) => {
      for (const { row, title } of plan) {
        // Lock and re-read the row: PostgreSQL timestamps may have microsecond
        // precision that is lost when Drizzle converts them to JS Dates.
        const [current] = await tx.select().from(products)
          .where(eq(products.id, row.id)).for('update');
        if (!current || current.deletedAt || current.title !== row.title) {
          throw new Error(`محصول ${row.productId} هم‌زمان تغییر کرده است؛ تراکنش لغو شد.`);
        }
        const [updated] = await tx.update(products).set({
          title,
          searchText: buildSearchText([
            title, current.subTitle, current.model,
            current.brandId ? brandNameById.get(current.brandId) : null,
            current.color, current.colorEn, current.sku, current.productId,
          ]),
          updatedAt: new Date(),
        }).where(and(eq(products.id, row.id), eq(products.title, row.title), isNull(products.deletedAt)))
          .returning({ id: products.id });
        if (!updated) throw new Error(`محصول ${row.productId} هم‌زمان تغییر کرده است؛ تراکنش لغو شد.`);
      }
    });

    let queuedForCrm = 0;
    const crmFailures: Array<{ productId: string; error: string }> = [];
    for (const { row } of plan) {
      try {
        await enqueueCrmProductSync(row.productId, 'update');
        queuedForCrm += 1;
      } catch (error) {
        crmFailures.push({ productId: row.productId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    console.log(JSON.stringify({ updatedProducts: plan.length, queuedForCrm, crmFailures }));
    if (crmFailures.length > 0) process.exitCode = 1;
  }
} finally {
  await closeDb();
}
