/** One-time, guarded import of the Yesido basket into site-owned products and bundle. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { formatProductTitle } from '@tamas/shared';
import { eq, inArray } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { brands, products } from '../src/db/schema.js';
import { buildSearchText } from '../src/services/catalog.js';
import { enqueueCrmProductSync } from '../src/services/crm-product-sync.js';
import { readTab } from '../src/services/sheets/client.js';
import { storage } from '../src/services/storage/index.js';

const BUNDLE_ID = '09999990001';
const BUNDLE_IMAGE = '/assets/bundles/yesido-basket-2026-10.webp';
const apply = process.argv.includes('--apply');
const expectedHash = process.argv.find((arg) => arg.startsWith('--plan-hash='))?.slice('--plan-hash='.length);

type SheetItem = {
  sourceCode: string;
  productId: string;
  title: string;
  model: string;
  qty: number;
  listPrice: number;
  discount: number;
  salePrice: number;
  total: number;
};

const newProducts: Record<string, { title: string; color: string; referenceCode: string }> = {
  '02030200148': {
    title: 'آداپتور شارژ USB+USB-C برند Yesido مدل YC47-20w سیم USB-C To Lightning 2 PIN/IR',
    color: 'سفید', referenceCode: '02030200143',
  },
  '02030100515': {
    title: 'کابل MicroUSB برند Yesido مدل CA26M طول 100cm',
    color: 'مشکی', referenceCode: '02030100508',
  },
  '02030100360': {
    title: 'کابل USB-C To USB-C برند Yesido مدل CA166 طول 120cm',
    color: 'مشکی', referenceCode: '02030100508',
  },
};

function numeric(value: string): number {
  const result = Number(value.replace(/[,\s]/g, '').replace('%', ''));
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`Invalid numeric sheet value: ${value}`);
  return result;
}

function snapshot(row: typeof products.$inferSelect | undefined) {
  if (!row) return null;
  return {
    id: row.id, productId: row.productId, sku: row.sku,
    title: row.title, model: row.model, color: row.color, brandId: row.brandId,
    categoryId: row.categoryId, price: row.price, oldPrice: row.oldPrice,
    discount: row.discount, promotion: row.promotion, status: row.status,
    stock: row.stock, kermanStock: row.kermanStock, tehranStock: row.tehranStock,
    imageUrl: row.imageUrl, deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

try {
  const raw = await readTab('yesido backet');
  const headers = (raw[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const indexes = ['sku', 'model', 'in baskt', 'site price', 'diccount', 'last price', 'total price']
    .map((name) => headers.indexOf(name));
  if (indexes.some((index) => index < 0)) throw new Error(`Unexpected headers: ${headers.join(', ')}`);

  const items: SheetItem[] = raw.slice(1).filter((row) => /^\d+$/.test((row[indexes[0]!] ?? '').trim())).map((row) => {
    const sourceCode = row[indexes[0]!]!.trim();
    const title = (row[indexes[1]!] ?? '').trim();
    const model = title.match(/مدل\s+([A-Za-z0-9-]+)/i)?.[1] ?? '';
    const item = {
      sourceCode,
      productId: sourceCode.startsWith('0') ? sourceCode : `0${sourceCode}`,
      title,
      model,
      qty: numeric(row[indexes[2]!] ?? ''),
      listPrice: numeric(row[indexes[3]!] ?? ''),
      discount: numeric(row[indexes[4]!] ?? ''),
      salePrice: numeric(row[indexes[5]!] ?? ''),
      total: numeric(row[indexes[6]!] ?? ''),
    };
    if (!item.model || item.qty < 1 || item.listPrice < 1 || item.salePrice < 1 || item.discount > 100 ||
      Math.round(item.listPrice * (100 - item.discount) / 100) !== item.salePrice ||
      item.salePrice * item.qty !== item.total) {
      throw new Error(`Invalid sheet item: ${sourceCode}`);
    }
    return item;
  });
  if (items.length !== 100 || new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new Error(`Expected 100 distinct products; got ${items.length}.`);
  }
  const qtyTotal = items.reduce((sum, item) => sum + item.qty, 0);
  const saleTotal = items.reduce((sum, item) => sum + item.total, 0);
  const listTotal = items.reduce((sum, item) => sum + item.listPrice * item.qty, 0);
  if (qtyTotal !== 177 || saleTotal !== 450_364_254) throw new Error('Sheet totals changed since reconciliation.');

  const [catalogue, brandRows] = await Promise.all([
    db.select().from(products).where(inArray(products.productId, [...items.map((item) => item.productId), BUNDLE_ID, ...Object.values(newProducts).map((value) => value.referenceCode)])),
    db.select({ id: brands.id, name: brands.name }).from(brands),
  ]);
  const byId = new Map(catalogue.map((row) => [row.productId, row]));
  const brandId = brandRows.find((row) => row.name.toLowerCase() === 'yesido')?.id;
  if (!brandId) throw new Error('YESIDO brand not found.');
  const missing = items.filter((item) => !byId.has(item.productId));
  if (missing.length !== 3 || missing.some((item) => !newProducts[item.productId])) {
    throw new Error(`Unexpected missing products: ${missing.map((item) => item.productId).join(', ')}`);
  }
  if (byId.has(BUNDLE_ID)) throw new Error(`Bundle ID ${BUNDLE_ID} is already used; refusing duplicate import.`);
  for (const item of items) {
    const existing = byId.get(item.productId);
    if (existing?.deletedAt || (existing?.brandId && existing.brandId !== brandId)) {
      throw new Error(`Product ${item.productId} is deleted or has a different brand.`);
    }
  }
  for (const definition of Object.values(newProducts)) {
    if (!byId.get(definition.referenceCode)?.categoryId) throw new Error(`Missing category reference ${definition.referenceCode}`);
  }

  const snapshotRows = items.map((item) => ({ item, before: snapshot(byId.get(item.productId)) }));
  const planHash = createHash('sha256').update(JSON.stringify({ snapshotRows, brandId, listTotal, saleTotal, bundleId: BUNDLE_ID })).digest('hex');
  const shortages = items.filter((item) => {
    const existing = byId.get(item.productId);
    return !existing || Math.max(existing.stock, existing.kermanStock + existing.tehranStock) < item.qty;
  }).map((item) => item.productId);
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run', sheetRows: items.length, totalUnits: qtyTotal,
    existing: items.length - missing.length, newCodes: missing.map((item) => item.productId),
    normalizedSourceCodes: items.filter((item) => item.sourceCode !== item.productId).map((item) => ({ from: item.sourceCode, to: item.productId })),
    grossPrice: listTotal, bundlePrice: saleTotal, bundleId: BUNDLE_ID,
    stockShortageCount: shortages.length, stockShortages: shortages,
    bundleWillBeOutOfStock: true, planHash,
  }, null, 2));

  if (!apply) process.exitCode = 0;
  else {
    if (expectedHash !== planHash) throw new Error('Plan hash mismatch; run dry-run again.');
    const backupRoot = storage.localRoot?.();
    if (!backupRoot) throw new Error('Safe backup path unavailable.');
    const backupDir = resolve(backupRoot, 'backups');
    await mkdir(backupDir, { recursive: true });
    const backupPath = resolve(backupDir, `yesido-basket-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), sourceSheet: 'yesido backet', planHash, snapshotRows }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ backupPath }));

    await db.transaction(async (tx) => {
      const locked = await tx.select().from(products).where(inArray(products.productId, items.map((item) => item.productId))).for('update');
      const lockedById = new Map(locked.map((row) => [row.productId, row]));
      for (const { item, before } of snapshotRows) {
        if (JSON.stringify(snapshot(lockedById.get(item.productId))) !== JSON.stringify(before)) {
          throw new Error(`Product ${item.productId} changed after the dry-run; transaction rolled back.`);
        }
      }
      const [existingBundle] = await tx.select({ id: products.id }).from(products).where(eq(products.productId, BUNDLE_ID)).limit(1);
      if (existingBundle) throw new Error('Bundle ID became occupied; transaction rolled back.');

      for (const item of items) {
        const existing = lockedById.get(item.productId);
        if (existing) {
          await tx.update(products).set({
            price: item.salePrice, oldPrice: item.listPrice, discount: item.discount,
            promotion: true, model: existing.model || item.model,
            searchText: buildSearchText([existing.title, existing.subTitle, existing.model || item.model, 'YESIDO', existing.color, existing.colorEn, existing.sku, existing.productId]),
            updatedAt: new Date(),
          }).where(eq(products.id, existing.id));
        } else {
          const definition = newProducts[item.productId]!;
          const reference = byId.get(definition.referenceCode)!;
          const title = formatProductTitle(definition.title);
          await tx.insert(products).values({
            productId: item.productId, sku: item.productId,
            title, model: item.model, color: definition.color,
            categoryId: reference.categoryId, brandId,
            price: item.salePrice, oldPrice: item.listPrice, discount: item.discount,
            stock: 0, kermanStock: 0, tehranStock: 0,
            status: 'active', promotion: true,
            searchText: buildSearchText([title, item.model, 'YESIDO', definition.color, item.productId]),
          });
        }
      }

      const bundleTitle = 'باندل کامل ۱۰۰ قلمی Yesido';
      await tx.insert(products).values({
        productId: BUNDLE_ID, sku: BUNDLE_ID, title: bundleTitle,
        model: 'Yesido Basket', brandId, type: 'bundle',
        price: saleTotal, oldPrice: listTotal, discount: 0,
        // Several component quantities are unavailable. Never advertise a
        // sellable bundle until a later verified stock adjustment.
        stock: 0, kermanStock: 0, tehranStock: 0,
        status: 'active', promotion: true,
        imageUrl: BUNDLE_IMAGE,
        description: 'باندل شامل ۱۰۰ مدل و ۱۷۷ عدد کالای Yesido مطابق فهرست ثبت‌شده در پنل مدیریت است. تصویر، نمای معرفی مجموعه است و عکس تک‌تک اقلام نیست.',
        bundleItems: items.map((item) => ({ productId: item.productId, qty: item.qty })),
        searchText: buildSearchText([bundleTitle, 'Yesido', 'باندل', BUNDLE_ID]),
      });
    });

    const crmErrors: Array<{ productId: string; error: string }> = [];
    for (const productId of [...items.map((item) => item.productId), BUNDLE_ID]) {
      try { await enqueueCrmProductSync(productId, 'update'); }
      catch (error) { crmErrors.push({ productId, error: error instanceof Error ? error.message : String(error) }); }
    }
    console.log(JSON.stringify({ updated: items.length - missing.length, created: missing.length, bundleId: BUNDLE_ID, queuedForCrm: items.length + 1 - crmErrors.length, crmErrors }));
    if (crmErrors.length) process.exitCode = 1;
  }
} finally {
  await closeDb();
}
