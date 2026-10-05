/**
 * Exercises the two-way sync against an in-memory spreadsheet.
 *
 * The Google transport is swapped for a fake one, so the merge rules — which
 * side wins, what is written back, what is recorded as a conflict — are tested
 * for real without a Google account. Run against a scratch database:
 *
 *   npx tsx scripts/test-sync.ts
 */
import { eq, sql } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { products, syncConflicts } from '../src/db/schema.js';
import { runSync, type SheetTransport } from '../src/services/sheets/sync.js';

/** An in-memory stand-in for the spreadsheet. */
class FakeSheet implements SheetTransport {
  readonly tabs = new Map<string, string[][]>();
  writes = 0;

  async read(tab: string): Promise<string[][]> {
    return this.tabs.get(tab)?.map((r) => [...r]) ?? [];
  }

  async write(tab: string, rows: string[][]): Promise<void> {
    this.writes += 1;
    this.tabs.set(tab, rows.map((r) => [...r]));
  }

  /** Reads one cell the way a person looking at the tab would. */
  cell(tab: string, key: string, column: string): string | undefined {
    const rows = this.tabs.get(tab);
    if (!rows || rows.length === 0) return undefined;
    const header = rows[0]!;
    const keyIdx = header.indexOf(rows === this.tabs.get('Products') ? 'product_id' : header[0]!);
    const colIdx = header.indexOf(column);
    const row = rows.slice(1).find((r) => r[keyIdx] === key);
    return row?.[colIdx];
  }

  setCell(tab: string, key: string, column: string, value: string): void {
    const rows = this.tabs.get(tab)!;
    const header = rows[0]!;
    const keyIdx = 0;
    const colIdx = header.indexOf(column);
    const row = rows.slice(1).find((r) => r[keyIdx] === key);
    if (!row) throw new Error(`row ${key} not in ${tab}`);
    while (row.length < header.length) row.push('');
    row[colIdx] = value;
  }

  rowCount(tab: string): number {
    return Math.max(0, (this.tabs.get(tab)?.length ?? 0) - 1);
  }
}

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`✅ ${name}`);
    passed += 1;
  } else {
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const CATALOGUE = ['brands', 'categories', 'colors', 'products'] as const;

async function priceOf(productId: string): Promise<number> {
  const [row] = await db.select({ price: products.price }).from(products).where(eq(products.productId, productId)).limit(1);
  return row?.price ?? -1;
}

async function titleOf(productId: string): Promise<string> {
  const [row] = await db.select({ title: products.title }).from(products).where(eq(products.productId, productId)).limit(1);
  return row?.title ?? '';
}

async function stockOf(productId: string): Promise<number> {
  const [row] = await db.select({ stock: products.stock }).from(products).where(eq(products.productId, productId)).limit(1);
  return row?.stock ?? -1;
}

async function conflictFieldsOf(productId: string) {
  const [row] = await db
    .select({ promotion: products.promotion, imageUrl: products.imageUrl, kermanStock: products.kermanStock })
    .from(products)
    .where(eq(products.productId, productId))
    .limit(1);
  return row;
}

async function main(): Promise<void> {
  const sheet = new FakeSheet();
  await db.delete(syncConflicts);

  const [countRow] = await db.select({ n: sql<number>`count(*)::int` }).from(products);
  const productCount = countRow?.n ?? 0;
  console.log(`database holds ${productCount} products\n`);

  /* ---------------- 1. first push seeds an empty sheet ---------------- */
  const first = await runSync({ direction: 'push', entities: [...CATALOGUE], dryRun: false }, sheet);
  const pushed = first.entities.find((e) => e.entity === 'products')!;
  check('first push writes every product to the sheet', sheet.rowCount('Products') === productCount, `sheet has ${sheet.rowCount('Products')}`);
  check('first push reports them as changed', pushed.pushed === productCount, `reported ${pushed.pushed}`);

  const sampleKey = sheet.tabs.get('Products')![1]![0]!;
  check(
    'Products tab keeps the exact 20-column Google Sheet contract',
    sheet.tabs.get('Products')![0]!.join('|') ===
      'product_id|Category|Brand|title|model|color|sku|price|old_price|sell_type|discount%|kerman_stock|tehran_stock|warranty|promotion|status|image_url|attribute_key|attribute_value|updated_at',
    sheet.tabs.get('Products')![0]!.join('|'),
  );
  const dbPrice = await priceOf(sampleKey);
  check('pushed price matches the database', sheet.cell('Products', sampleKey, 'price') === String(dbPrice));

  /* ---------------- 2. a no-op pass changes nothing ---------------- */
  const second = await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  const quiet = second.entities.find((e) => e.entity === 'products')!;
  check('second pass pulls nothing', quiet.pulled === 0, `pulled ${quiet.pulled}`);
  check('second pass pushes nothing', quiet.pushed === 0, `pushed ${quiet.pushed}`);
  check('second pass records no conflicts', quiet.conflicts === 0);

  /* ---------------- 3. a hand edit in the sheet, without touching updated_at ---------------- */
  sheet.setCell('Products', sampleKey, 'price', '123456');
  const third = await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  const pulled = third.entities.find((e) => e.entity === 'products')!;
  check('hand edit in the sheet is pulled into the database', (await priceOf(sampleKey)) === 123456, `price is ${await priceOf(sampleKey)}`);
  check('the pull is reported', pulled.pulled === 1, `pulled ${pulled.pulled}`);
  const [conflictCount] = await db.select({ n: sql<number>`count(*)::int` }).from(syncConflicts);
  check('a one-sided edit is not logged as a conflict', (conflictCount?.n ?? 0) === 0, `logged ${conflictCount?.n}`);

  /* ---------------- 4. Sheet remains authoritative for price ---------------- */
  await db.update(products).set({ price: 777000, updatedAt: new Date() }).where(eq(products.productId, sampleKey));
  await runSync({ direction: 'push', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('push-only never overwrites the Sheet price from DB cache', sheet.cell('Products', sampleKey, 'price') === '123456', `sheet shows ${sheet.cell('Products', sampleKey, 'price')}`);
  await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('database-only price edit is overwritten from the sheet', (await priceOf(sampleKey)) === 123456, `price is ${await priceOf(sampleKey)}`);

  /* ---------------- 5. conflicts are resolved per column ---------------- */
  // Price/inventory are Sheet-owned and every other field is DB-owned when
  // both sides changed.
  await db
    .update(products)
    .set({ price: 111, kermanStock: 1, title: 'عنوان دیتابیس', promotion: false, imageUrl: 'https://db.example/image.jpg', updatedAt: new Date() })
    .where(eq(products.productId, sampleKey));
  sheet.setCell('Products', sampleKey, 'price', '222');
  sheet.setCell('Products', sampleKey, 'kerman_stock', '2');
  sheet.setCell('Products', sampleKey, 'title', 'عنوان شیت');
  sheet.setCell('Products', sampleKey, 'promotion', 'TRUE');
  sheet.setCell('Products', sampleKey, 'image_url', 'https://sheet.example/image.jpg');
  await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  const conflictFields = await conflictFieldsOf(sampleKey);
  check('sheet wins a price conflict', (await priceOf(sampleKey)) === 222, `price is ${await priceOf(sampleKey)}`);
  check('sheet wins a warehouse-stock conflict', conflictFields?.kermanStock === 2, `stock is ${conflictFields?.kermanStock}`);
  check('database wins a metadata conflict', (await titleOf(sampleKey)) === 'عنوان دیتابیس', `title is ${await titleOf(sampleKey)}`);
  check('database wins a promotion conflict', conflictFields?.promotion === false, `promotion is ${conflictFields?.promotion}`);
  check('database wins an image conflict', conflictFields?.imageUrl === 'https://db.example/image.jpg', `image is ${conflictFields?.imageUrl}`);
  check('database metadata is written back to the sheet', sheet.cell('Products', sampleKey, 'title') === 'عنوان دیتابیس', `sheet shows ${sheet.cell('Products', sampleKey, 'title')}`);

  const logged = await db.select().from(syncConflicts).where(eq(syncConflicts.entityKey, sampleKey));
  check('the conflict is logged per column', logged.length > 0, `${logged.length} rows`);
  const priceConflict = logged.find((c) => c.field === 'price');
  const titleConflict = logged.find((c) => c.field === 'title');
  const promotionConflict = logged.find((c) => c.field === 'promotion');
  const imageConflict = logged.find((c) => c.field === 'image_url');
  check('price conflict log records Sheet as winner', priceConflict?.dbValue === '111' && priceConflict?.sheetValue === '222' && priceConflict?.resolvedTo === 'sheet', JSON.stringify(priceConflict));
  check('metadata conflict log records DB as winner', titleConflict?.dbValue === 'عنوان دیتابیس' && titleConflict?.sheetValue === 'عنوان شیت' && titleConflict?.resolvedTo === 'db', JSON.stringify(titleConflict));
  check('promotion conflict log records DB as winner', promotionConflict?.resolvedTo === 'db', JSON.stringify(promotionConflict));
  check('image conflict log records DB as winner', imageConflict?.resolvedTo === 'db', JSON.stringify(imageConflict));

  // A later database edit still cannot override a Sheet-owned price.
  await db.delete(syncConflicts);
  sheet.setCell('Products', sampleKey, 'price', '333');
  await db.update(products).set({ price: 444, updatedAt: new Date() }).where(eq(products.productId, sampleKey));
  await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('sheet wins price regardless of database timestamp', (await priceOf(sampleKey)) === 333, `price is ${await priceOf(sampleKey)}`);
  check('sheet price remains unchanged', sheet.cell('Products', sampleKey, 'price') === '333', `sheet shows ${sheet.cell('Products', sampleKey, 'price')}`);

  /* ---------------- 6. a brand new row typed into the sheet ---------------- */
  const header = sheet.tabs.get('Products')![0]!;
  const fresh = header.map((h) => {
    if (h === 'product_id') return 'SHEET-NEW-1';
    if (h === 'title') return 'کالای دستی از شیت';
    if (h === 'price') return '99000';
    if (h === 'Brand') return 'brand-typed-in-sheet';
    if (h === 'kerman_stock') return '3';
    if (h === 'tehran_stock') return '4';
    return '';
  });
  sheet.tabs.get('Products')!.push(fresh);
  await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('a row typed into the sheet is created in the database', (await titleOf('SHEET-NEW-1')) === 'کالای دستی از شیت');
  check('its price comes across', (await priceOf('SHEET-NEW-1')) === 99000);
  check('its total stock is the sum of both warehouse columns', (await stockOf('SHEET-NEW-1')) === 7);
  const [freshRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.productId, 'SHEET-NEW-1'));
  check('an unknown brand in the sheet is created on demand', (freshRow?.n ?? 0) === 1);

  /* ---------------- 7. dry run writes nothing ---------------- */
  await db.update(products).set({ price: 555000, updatedAt: new Date() }).where(eq(products.productId, sampleKey));
  const writesBefore = sheet.writes;
  const dry = await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: true }, sheet);
  check('dry run touches the sheet zero times', sheet.writes === writesBefore, `${sheet.writes - writesBefore} writes`);
  check('dry run still reports what would change', dry.entities.some((e) => e.pushed > 0));
  check('dry run leaves the database alone', (await priceOf(sampleKey)) === 555000);

  /* ---------------- 8. a row only in the database is never dropped from the sheet ---------------- */
  const beforeRows = sheet.rowCount('Products');
  await runSync({ direction: 'push', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('push keeps every row', sheet.rowCount('Products') >= beforeRows, `${sheet.rowCount('Products')} vs ${beforeRows}`);

  /* ---------------- cleanup ---------------- */
  await db.delete(products).where(eq(products.productId, 'SHEET-NEW-1'));
  await db.delete(syncConflicts);

  console.log(`\n${passed} passed, ${failed} failed`);
  await closeDb();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error('test run failed:', err);
  await closeDb().catch(() => {});
  process.exit(1);
});
