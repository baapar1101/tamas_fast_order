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

  /* -------- 3b. editing only the rial price column also updates DB -------- */
  sheet.setCell('Products', sampleKey, 'RIAL PRICE', '2345670');
  const rialEdit = await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  const rialPulled = rialEdit.entities.find((e) => e.entity === 'products')!;
  check('RIAL PRICE edit is converted to toman and pulled', (await priceOf(sampleKey)) === 234567, `price is ${await priceOf(sampleKey)}`);
  check('RIAL PRICE pull is reported', rialPulled.pulled === 1, `pulled ${rialPulled.pulled}`);

  /* ---------------- 4. an edit in the database goes back to the sheet ---------------- */
  await db.update(products).set({ price: 777000, updatedAt: new Date() }).where(eq(products.productId, sampleKey));
  await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('database edit is pushed to the sheet', sheet.cell('Products', sampleKey, 'price') === '777000', `sheet shows ${sheet.cell('Products', sampleKey, 'price')}`);

  /* ---------------- 5. both sides edited: newer updated_at wins ---------------- */
  // Database edited now; sheet claims an hour in the future, so the sheet wins.
  await db.update(products).set({ price: 111, updatedAt: new Date() }).where(eq(products.productId, sampleKey));
  sheet.setCell('Products', sampleKey, 'price', '222');
  sheet.setCell('Products', sampleKey, 'updated_at', new Date(Date.now() + 3600_000).toISOString());
  await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('newer sheet timestamp wins the conflict', (await priceOf(sampleKey)) === 222, `price is ${await priceOf(sampleKey)}`);

  const logged = await db.select().from(syncConflicts).where(eq(syncConflicts.entityKey, sampleKey));
  check('the conflict is logged per column', logged.length > 0, `${logged.length} rows`);
  const priceConflict = logged.find((c) => c.field === 'price');
  check('the log names both values and the winner', priceConflict?.dbValue === '111' && priceConflict?.sheetValue === '222' && priceConflict?.resolvedTo === 'sheet', JSON.stringify(priceConflict));

  // Now the other way: the database is newer, so it wins.
  await db.delete(syncConflicts);
  sheet.setCell('Products', sampleKey, 'price', '333');
  sheet.setCell('Products', sampleKey, 'updated_at', new Date(Date.now() - 3600_000).toISOString());
  await db.update(products).set({ price: 444, updatedAt: new Date() }).where(eq(products.productId, sampleKey));
  await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('newer database timestamp wins the conflict', (await priceOf(sampleKey)) === 444, `price is ${await priceOf(sampleKey)}`);
  check('the database value is written back to the sheet', sheet.cell('Products', sampleKey, 'price') === '444', `sheet shows ${sheet.cell('Products', sampleKey, 'price')}`);

  /* ---------------- 6. a brand new row typed into the sheet ---------------- */
  const header = sheet.tabs.get('Products')![0]!;
  const fresh = header.map((h) => {
    if (h === 'product_id') return 'SHEET-NEW-1';
    if (h === 'title') return 'کالای دستی از شیت';
    if (h === 'price') return '99000';
    if (h === 'Brand') return 'brand-typed-in-sheet';
    if (h === 'stock') return '7';
    if (h === 'status') return 'active';
    return '';
  });
  sheet.tabs.get('Products')!.push(fresh);
  await runSync({ direction: 'both', entities: [...CATALOGUE], dryRun: false }, sheet);
  check('a row typed into the sheet is created in the database', (await titleOf('SHEET-NEW-1')) === 'کالای دستی از شیت');
  check('its price comes across', (await priceOf('SHEET-NEW-1')) === 99000);
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
