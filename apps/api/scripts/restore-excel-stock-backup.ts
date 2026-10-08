/** Selectively restore quantities from an Excel import backup with a guarded plan. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { products } from '../src/db/schema.js';
import { env } from '../src/env.js';
import { invalidateCatalog } from '../src/services/catalog.js';
import { enqueueCrmProductSync } from '../src/services/crm-product-sync.js';
import { runSync } from '../src/services/sheets/sync.js';

interface BackupRow {
  productId: string;
  sku: string | null;
  old: { price: number; stock: number; kermanStock: number; tehranStock: number };
  next: { price: number; stock: number; kermanStock: number; tehranStock: number };
}

const backupArg = process.argv.find((arg) => arg.startsWith('--backup='))?.slice('--backup='.length);
const maxPriceArg = process.argv.find((arg) => arg.startsWith('--max-price='))?.slice('--max-price='.length);
const expectedHash = process.argv.find((arg) => arg.startsWith('--plan-hash='))?.slice('--plan-hash='.length);
const apply = process.argv.includes('--apply');

try {
  const maxPrice = Number(maxPriceArg);
  if (!backupArg || !Number.isSafeInteger(maxPrice) || maxPrice < 1 || maxPrice > 1000) {
    throw new Error('مسیر پشتیبان و سقف قیمت معتبر را با --backup=... و --max-price=... وارد کنید.');
  }
  if (apply && !expectedHash) throw new Error('برای اعمال، --plan-hash پیش‌نمایش لازم است.');
  const backupDir = resolve(process.cwd(), '.private', 'backups');
  const backupPath = resolve(backupArg);
  if (!backupPath.startsWith(`${backupDir}${sep}`)) throw new Error('فایل پشتیبان باید در مسیر خصوصی پروژه باشد.');
  const source = JSON.parse(await readFile(backupPath, 'utf8')) as { products?: BackupRow[] };
  if (!Array.isArray(source.products)) throw new Error('ساختار فایل پشتیبان معتبر نیست.');
  const candidates = source.products.filter(({ old, next }) =>
    Number.isSafeInteger(old?.price) && old.price > 0 && old.price <= maxPrice &&
    old.stock === 0 && Number.isSafeInteger(next?.stock) && next.stock > 0 &&
    old.price === next.price);
  if (!candidates.length) throw new Error('کالایی برای بازگرداندن با این شرط قیمت پیدا نشد.');
  const currentRows = await db.select({
    id: products.id, productId: products.productId, sku: products.sku, price: products.price,
    stock: products.stock, kermanStock: products.kermanStock, tehranStock: products.tehranStock,
  }).from(products).where(and(inArray(products.productId, candidates.map((row) => row.productId)), isNull(products.deletedAt)));
  const byId = new Map(currentRows.map((row) => [row.productId, row]));
  const conflicts = candidates.filter((row) => {
    const current = byId.get(row.productId);
    return !current || current.sku !== row.sku || current.price !== row.next.price ||
      current.stock !== row.next.stock || current.kermanStock !== row.next.kermanStock ||
      current.tehranStock !== row.next.tehranStock;
  });
  const plan = candidates.filter((row) => !conflicts.includes(row))
    .sort((a, b) => a.productId.localeCompare(b.productId));
  const planHash = createHash('sha256').update(JSON.stringify(plan.map((row) => ({
    productId: row.productId, old: row.old, next: row.next,
  })))).digest('hex');
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', restoreCount: plan.length,
    conflictCount: conflicts.length, conflictExamples: conflicts.slice(0, 10).map((row) => row.productId),
    maxPrice, planHash }, null, 2));
  if (conflicts.length) throw new Error('موجودی یا قیمت بعضی کالاها پس از بارگذاری تغییر کرده است؛ بازگردانی لغو شد.');
  if (!apply) process.exitCode = 0;
  else {
    if (expectedHash !== planHash) throw new Error('هش طرح با پیش‌نمایش برابر نیست.');
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    const rollbackPath = resolve(backupDir, `excel-stock-rollback-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await writeFile(rollbackPath, JSON.stringify({ createdAt: new Date().toISOString(), sourceBackup: backupPath,
      planHash, products: plan }, null, 2), { mode: 0o600 });
    await db.transaction(async (tx) => {
      for (const row of plan) {
        const current = byId.get(row.productId)!;
        const [updated] = await tx.update(products).set({ stock: row.old.stock,
          kermanStock: row.old.kermanStock, tehranStock: row.old.tehranStock, updatedAt: new Date() })
          .where(and(eq(products.id, current.id), isNull(products.deletedAt),
            eq(products.price, row.next.price), eq(products.stock, row.next.stock),
            eq(products.kermanStock, row.next.kermanStock), eq(products.tehranStock, row.next.tehranStock)))
          .returning({ id: products.id });
        if (!updated) throw new Error(`محصول ${row.productId} هم‌زمان تغییر کرده است؛ تراکنش لغو شد.`);
      }
    });
    invalidateCatalog();
    const errors: string[] = [];
    for (const row of plan) {
      try { await enqueueCrmProductSync(row.productId, 'update', { source: 'excel-stock-rollback' }); }
      catch (error) { errors.push(`${row.productId}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (env.SHEETS_ENABLED) {
      try {
        const sync = await runSync({ direction: 'push', entities: ['products'], dryRun: false });
        const error = sync.entities.find((entity) => entity.entity === 'products')?.error;
        if (error) errors.push(`Google Sheets: ${error}`);
      } catch (error) { errors.push(`Google Sheets: ${error instanceof Error ? error.message : String(error)}`); }
    }
    console.log(JSON.stringify({ restored: plan.length, rollbackPath, errors }, null, 2));
  }
} finally {
  await closeDb();
}
