import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as xlsx from '@e965/xlsx';
import postgres from 'postgres';

const [pricePath, stockPath] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const apply = process.argv.includes('--apply');
const stockOnly = process.argv.includes('--stock-only');
const allowUnpriced = process.argv.includes('--allow-unpriced');
if (!pricePath || !stockPath) throw new Error('Usage: node scripts/import-kerman-price-stock.mjs PRICE.xlsx STOCK.xlsx [--apply] [--stock-only] [--allow-unpriced]');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');

async function readSource(path, valueHeader) {
  const buffer = await readFile(path);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.['!ref']) throw new Error('Workbook is empty: ' + path);
  const cell = (row, col) => sheet[xlsx.utils.encode_cell({ r: row, c: col })]?.v;
  if (String(cell(0, 0)).trim().toLowerCase() !== 'sku' ||
      String(cell(0, 1)).trim().toLowerCase() !== valueHeader) {
    throw new Error('Unexpected headers in ' + path);
  }
  const range = xlsx.utils.decode_range(sheet['!ref']);
  const rows = [];
  const seen = new Set();
  for (let row = 1; row <= range.e.r; row += 1) {
    const rawSku = cell(row, 0);
    const rawValue = cell(row, 1);
    if ((rawSku == null || rawSku === '') && (rawValue == null || rawValue === '')) continue;
    const sku = String(rawSku ?? '').normalize('NFKC').replace(/\s+/g, '');
    const value = Number(rawValue);
    if (!/^\d{11,12}$/.test(sku) || !Number.isSafeInteger(value) || value < 0 ||
        rawValue == null || rawValue === '' || seen.has(sku)) {
      throw new Error('Invalid/duplicate SKU or value in ' + path + ', row ' + (row + 1));
    }
    if (valueHeader === 'price' && (value === 0 || value % 10 !== 0)) {
      throw new Error('Price must be a positive whole-toman rial amount, row ' + (row + 1));
    }
    seen.add(sku);
    rows.push({ sku, value, row: row + 1 });
  }
  return { rows, sha256: createHash('sha256').update(buffer).digest('hex') };
}

const [priceSource, stockSource] = await Promise.all([
  readSource(pricePath, 'price'),
  readSource(stockPath, 'kerman_stock'),
]);
const db = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const products = await db`
    SELECT p.id, p.product_id, p.sku, p.title, p.price, p.kerman_stock,
           p.tehran_stock, p.stock, p.updated_at, p.type, p.bundle_items,
           c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NULL
    ORDER BY p.id
  `;
  const byCode = new Map();
  for (const product of products) {
    byCode.set(product.product_id, product);
    if (product.sku) byCode.set(product.sku, product);
  }
  function sourceMap(source, isPrice) {
    const mapped = new Map();
    const unmatched = [];
    const fixedLeadingZero = [];
    for (const row of source.rows) {
      let product = byCode.get(row.sku);
      if (!product && !row.sku.startsWith('0')) {
        product = byCode.get('0' + row.sku);
        if (product) fixedLeadingZero.push({ from: row.sku, to: product.product_id });
      }
      if (!product) {
        unmatched.push(row.sku);
        continue;
      }
      if (mapped.has(product.product_id)) {
        throw new Error('Two source rows resolve to SKU ' + product.product_id);
      }
      mapped.set(product.product_id, isPrice ? row.value / 10 : row.value);
    }
    return { mapped, unmatched, fixedLeadingZero };
  }

  const prices = sourceMap(priceSource, true);
  const stocks = sourceMap(stockSource, false);
  const protectedIds = new Set();
  for (const product of products) {
    if (product.category_name === 'Bondle' || product.type === 'bundle') {
      protectedIds.add(product.product_id);
    }
    for (const item of product.bundle_items ?? []) {
      if (typeof item.productId === 'string') protectedIds.add(item.productId);
    }
  }
  // The six newer basket products list their components by name, not by SKU.
  // Conservatively preserve the catalog matches that are absent from this stock file.
  for (const sku of [
    '02030200042', // Apple 20W adapter
    '02030200137', // Apple 20W adapter
    '02030200134', // Apple 40W adapter
    '02030200123', // Apple 40W original adapter
    '02030100393', // Samsung S23 cable
  ]) protectedIds.add(sku);

  const changes = [];
  const unpriced = [];
  const zeroedMissing = [];
  for (const product of products) {
    const sku = product.product_id;
    const oldPrice = Number(product.price);
    const oldKerman = product.kerman_stock;
    const oldTehran = product.tehran_stock;
    const oldStock = product.stock;
    const newPrice = !stockOnly && prices.mapped.has(sku) ? prices.mapped.get(sku) : oldPrice;
    const hasStock = stocks.mapped.has(sku);
    const sourceStock = stocks.mapped.get(sku);
    const unsafe = hasStock && sourceStock > 0 && newPrice < 1000;
    if (unsafe) unpriced.push({ sku, title: product.title, stock: sourceStock, price: newPrice });
    const newKerman = hasStock
      ? (unsafe && !allowUnpriced ? 0 : sourceStock)
      : (protectedIds.has(sku) ? oldKerman : 0);
    const newStock = !hasStock && protectedIds.has(sku)
      ? oldStock
      : newKerman + oldTehran;
    if (!hasStock && !protectedIds.has(sku) && oldKerman > 0) zeroedMissing.push(sku);
    if (newPrice !== oldPrice || newKerman !== oldKerman || newStock !== oldStock) {
      changes.push({
        id: product.id, sku, title: product.title,
        old_price: oldPrice, old_kerman: oldKerman, old_tehran: oldTehran,
        old_stock: oldStock, old_updated_at: product.updated_at.toISOString(),
        new_price: newPrice, new_kerman: newKerman, new_stock: newStock,
      });
    }
  }

  const report = {
    priceRows: priceSource.rows.length, stockRows: stockSource.rows.length,
    priceMatched: prices.mapped.size, stockMatched: stocks.mapped.size,
    priceFixedLeadingZero: prices.fixedLeadingZero.length,
    stockFixedLeadingZero: stocks.fixedLeadingZero.length,
    priceUnmatched: prices.unmatched, stockUnmatched: stocks.unmatched,
    basketRelatedProtected: [...protectedIds].filter((sku) => byCode.has(sku) && !stocks.mapped.has(sku)).length,
    unsafeUnpriced: unpriced, zeroedMissingCount: zeroedMissing.length,
    priceChanges: changes.filter((row) => row.new_price !== row.old_price).length,
    kermanChanges: changes.filter((row) => row.new_kerman !== row.old_kerman).length,
    totalChanges: changes.length, stockOnly, allowUnpriced,
  };
  console.log(JSON.stringify(report));
  if (!apply) {
    console.log('DRY RUN: no database rows changed');
  } else {
    if (unpriced.length && !process.argv.includes('--allow-unpriced') &&
        !process.argv.includes('--zero-unpriced')) {
      throw new Error('Explicitly choose --zero-unpriced or --allow-unpriced');
    }
    if (changes.length === 0) {
      console.log('Nothing to update');
    } else {
      const backupDir = '/root/tamas_fast_order-backups';
      await mkdir(backupDir, { recursive: true, mode: 0o700 });
      const backupPath = join(
        backupDir,
        'kerman-price-stock-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json.gz',
      );
      const backup = {
        createdAt: new Date().toISOString(),
        sourceSha256: { price: priceSource.sha256, stock: stockSource.sha256 },
        rows: changes,
      };
      await writeFile(backupPath, gzipSync(Buffer.from(JSON.stringify(backup))), { flag: 'wx', mode: 0o600 });
      await db.begin(async (tx) => {
        const updated = await tx`
          UPDATE products p SET
            price = incoming.new_price,
            kerman_stock = incoming.new_kerman,
            stock = incoming.new_stock,
            updated_at = NOW()
          FROM jsonb_to_recordset(${db.json(changes)}::jsonb) AS incoming(
            id integer, old_price bigint, old_kerman integer,
            old_tehran integer, old_stock integer, old_updated_at timestamptz,
            new_price bigint, new_kerman integer, new_stock integer
          )
          WHERE p.id = incoming.id AND p.deleted_at IS NULL
            AND p.price = incoming.old_price
            AND p.kerman_stock = incoming.old_kerman
            AND p.tehran_stock = incoming.old_tehran
            AND p.stock = incoming.old_stock
            AND p.updated_at = incoming.old_updated_at
          RETURNING p.product_id
        `;
        if (updated.length !== changes.length) {
          throw new Error('Product data changed during import; transaction rolled back');
        }
        const updatedSkus = updated.map((row) => row.product_id);
        await tx`
          INSERT INTO crm_sync_logs (entity, entity_key, action, status, payload)
          SELECT 'product', p.product_id, 'update', 'pending',
                 ${db.json({ source: 'kerman-price-stock-import', attempt: 0 })}::jsonb
          FROM products p
          WHERE p.product_id = ANY(${updatedSkus}::text[])
            AND NOT EXISTS (
              SELECT 1 FROM crm_sync_logs c
              WHERE c.entity = 'product' AND c.entity_key = p.product_id
                AND c.action = 'update' AND c.status = 'pending'
            )
        `;
        await tx`
          INSERT INTO audit_log (actor_id, action, entity, entity_key, detail)
          VALUES (NULL, 'bulk_kerman_import', 'product', NULL,
            ${db.json({
              updated: updated.length, backupPath,
              priceSha256: priceSource.sha256, stockSha256: stockSource.sha256,
              stockOnly, allowUnpriced,
            })}::jsonb)
        `;
      });
      console.log('APPLIED ' + changes.length + ' products; backup: ' + backupPath);
    }
  }
} finally {
  await db.end();
}
