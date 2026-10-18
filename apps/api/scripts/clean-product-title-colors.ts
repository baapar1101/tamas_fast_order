/** One-time product-title cleanup. Defaults to a read-only preview. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { brands, products } from '../src/db/schema.js';
import { cleanProductTitleColor } from '../src/lib/product-title-color.js';
import { buildSearchText } from '../src/services/catalog.js';
import { enqueueCrmProductSync } from '../src/services/crm-product-sync.js';
import { storage } from '../src/services/storage/index.js';

const apply = process.argv.includes('--apply');
const expectedHash = process.argv.find((arg) => arg.startsWith('--plan-hash='))?.slice('--plan-hash='.length);

try {
  const [rows, brandRows] = await Promise.all([
    db.select().from(products).where(isNull(products.deletedAt)),
    db.select({ id: brands.id, name: brands.name }).from(brands),
  ]);
  const brandNameById = new Map(brandRows.map((brand) => [brand.id, brand.name]));
  const plan = rows.map((row) => ({ row, clean: cleanProductTitleColor(row.title, row.color) }))
    .filter(({ clean }) => clean.changed)
    .sort((a, b) => a.row.productId.localeCompare(b.row.productId));
  if (plan.some(({ clean }) => !clean.title || cleanProductTitleColor(clean.title, clean.color).changed)) {
    throw new Error('طرح پاک‌سازی شامل عنوان خالی یا تغییر غیربازگشتی است.');
  }

  const summary = plan.map(({ row, clean }) => ({
    productId: row.productId,
    oldTitle: row.title,
    title: clean.title,
    oldColor: row.color,
    color: clean.color,
    detectedColor: clean.detectedColor,
    colorConflict: clean.colorConflict,
  }));
  const planHash = createHash('sha256').update(JSON.stringify(summary)).digest('hex');
  const conflicts = summary.filter((item) => item.colorConflict);
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    totalActiveProducts: rows.length,
    changedProducts: plan.length,
    filledMissingColors: summary.filter((item) => !item.oldColor && item.color).length,
    colorConflictCount: conflicts.length,
    planHash,
    examples: summary.slice(0, 20),
    conflicts,
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
    const backupPath = resolve(backupDir, `product-title-colors-${timestamp}.json`);
    await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), planHash, products: summary }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ backupPath }));

    await db.transaction(async (tx) => {
      for (const { row, clean } of plan) {
        const [updated] = await tx.update(products).set({
          title: clean.title,
          color: clean.color,
          searchText: buildSearchText([
            clean.title, row.subTitle, row.model,
            row.brandId ? brandNameById.get(row.brandId) : null,
            clean.color, row.colorEn, row.sku, row.productId,
          ]),
          updatedAt: new Date(),
        }).where(and(eq(products.id, row.id), eq(products.updatedAt, row.updatedAt))).returning({ id: products.id });
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
