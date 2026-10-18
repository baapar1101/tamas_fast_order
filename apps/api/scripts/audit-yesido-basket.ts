/** Read-only reconciliation of the Yesido basket tab with the site catalogue. */
import { isNull } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { brands, products } from '../src/db/schema.js';
import { readTab } from '../src/services/sheets/client.js';

const rows = await readTab('yesido backet');
const header = (rows[0] ?? []).map((cell) => cell.trim().toLowerCase());
const columns = {
  sku: header.indexOf('sku'),
  model: header.indexOf('model'),
  quantity: header.indexOf('in baskt'),
  price: header.indexOf('site price'),
  discount: header.indexOf('diccount'),
  lastPrice: header.indexOf('last price'),
  total: header.indexOf('total price'),
};
if (Object.values(columns).some((index) => index < 0)) throw new Error(`Unexpected sheet headers: ${header.join(', ')}`);

const number = (value: string) => Number(value.replace(/[,\s]/g, ''));
const parsedRows = rows.slice(1).map((row, index) => ({
  sheetRow: index + 2,
  sku: (row[columns.sku] ?? '').trim(),
  title: (row[columns.model] ?? '').trim(),
  quantity: number(row[columns.quantity] ?? ''),
  price: number(row[columns.price] ?? ''),
  discount: number((row[columns.discount] ?? '').replace('%', '')),
  lastPrice: number(row[columns.lastPrice] ?? ''),
  total: number(row[columns.total] ?? ''),
}));
const entries = parsedRows.filter((entry) => /^\d+$/.test(entry.sku));

const catalogue = await db.select({
  id: products.id, productId: products.productId, sku: products.sku, type: products.type,
  title: products.title, model: products.model, color: products.color, categoryId: products.categoryId, brandId: products.brandId,
  price: products.price, oldPrice: products.oldPrice, discount: products.discount,
  promotion: products.promotion, status: products.status, stock: products.stock,
  kermanStock: products.kermanStock, tehranStock: products.tehranStock,
  imageUrl: products.imageUrl, bundleItems: products.bundleItems, deletedAt: products.deletedAt,
}).from(products);
const brandRows = await db.select({ id: brands.id, name: brands.name }).from(brands);
const brandById = new Map(brandRows.map((brand) => [brand.id, brand.name]));
const byProductId = new Map(catalogue.map((row) => [row.productId, row]));
const bySku = new Map(catalogue.filter((row) => row.sku).map((row) => [row.sku, row]));
const matched = entries.map((entry) => {
  const normalizedSku = entry.sku.startsWith('0') ? entry.sku : `0${entry.sku}`;
  const site = byProductId.get(entry.sku) ?? bySku.get(entry.sku)
    ?? byProductId.get(normalizedSku) ?? bySku.get(normalizedSku);
  return { ...entry, site: site ? {
    id: site.id, productId: site.productId, sku: site.sku, title: site.title,
    model: site.model, color: site.color, categoryId: site.categoryId, brand: site.brandId ? brandById.get(site.brandId) : null,
    price: site.price, oldPrice: site.oldPrice, discount: site.discount,
    promotion: site.promotion, status: site.status, stock: site.stock,
    kermanStock: site.kermanStock, tehranStock: site.tehranStock,
    imageUrl: site.imageUrl, deleted: site.deletedAt != null,
  } : null };
});

console.log(JSON.stringify({
  sheetRows: entries.length,
  existingBundles: catalogue.filter((row) => row.type === 'bundle' && !row.deletedAt).map((row) => ({ productId: row.productId, title: row.title, items: row.bundleItems.length })),
  reservedBundleIdExists: byProductId.has('09999990001'),
  nonZeroPrefix: entries.filter((entry) => !entry.sku.startsWith('0')).map((entry) => ({ sheetRow: entry.sheetRow, sku: entry.sku, normalizedSku: `0${entry.sku}` })),
  excludedRows: parsedRows.filter((entry) => entry.sku && entry.sku !== 'جمع' && !/^\d+$/.test(entry.sku)),
  duplicateSkus: entries.map((entry) => entry.sku).filter((sku, index, all) => all.indexOf(sku) !== index),
  sheetTotalQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
  sheetTotalPrice: entries.reduce((sum, entry) => sum + entry.total, 0),
  badMath: entries.filter((entry) => entry.lastPrice * entry.quantity !== entry.total || Math.round(entry.price * (100 - entry.discount) / 100) !== entry.lastPrice),
  missing: matched.filter((entry) => !entry.site).map(({ site: _site, ...entry }) => entry),
  missingCandidates: matched.filter((entry) => !entry.site).map((entry) => {
    const model = entry.title.match(/مدل\s+([\w-]+)/i)?.[1]?.toLowerCase();
    return { sku: entry.sku, model, candidates: model ? catalogue.filter((row) => row.title.toLowerCase().includes(model)).map((row) => ({ productId: row.productId, sku: row.sku, title: row.title, deleted: row.deletedAt != null })) : [] };
  }),
  deleted: matched.filter((entry) => entry.site?.deleted).map((entry) => entry.sku),
  summary: {
    existing: matched.filter((entry) => entry.site && !entry.site.deleted).length,
    promoted: matched.filter((entry) => entry.site?.promotion).length,
    salePricesEqual: matched.filter((entry) => entry.site?.price === entry.lastPrice).length,
    listPricesEqual: matched.filter((entry) => entry.site?.oldPrice === entry.price).length,
    discountEqual: matched.filter((entry) => entry.site?.discount === entry.discount).length,
    withoutImage: matched.filter((entry) => entry.site && !entry.site.imageUrl).length,
    withoutModel: matched.filter((entry) => entry.site && !entry.site.model).length,
    withoutColor: matched.filter((entry) => entry.site && !entry.site.color).length,
    insufficientStockForBundle: matched.filter((entry) => entry.site && Math.max(entry.site.stock, entry.site.kermanStock + entry.site.tehranStock) < entry.quantity).length,
  },
  stockShortages: matched.filter((entry) => entry.site && Math.max(entry.site.stock, entry.site.kermanStock + entry.site.tehranStock) < entry.quantity).map((entry) => ({ sku: entry.sku, needed: entry.quantity, stock: entry.site?.stock, kermanStock: entry.site?.kermanStock, tehranStock: entry.site?.tehranStock })),
  bundle: (() => {
    const row = byProductId.get('09999990001');
    const expectedItems = entries.map((entry) => ({ productId: entry.sku.startsWith('0') ? entry.sku : `0${entry.sku}`, qty: entry.quantity }));
    return row ? {
      productId: row.productId, price: row.price, oldPrice: row.oldPrice,
      promotion: row.promotion, stock: row.stock, imageUrl: row.imageUrl,
      itemCount: row.bundleItems.length,
      quantity: row.bundleItems.reduce((sum, item) => sum + item.qty, 0),
      itemsMatchSheet: row.bundleItems.length === expectedItems.length && row.bundleItems.every((item, index) =>
        item.productId === expectedItems[index]?.productId && item.qty === expectedItems[index]?.qty),
    } : null;
  })(),
  ...(process.argv.includes('--details') ? { differences: matched.filter((entry) => !entry.site || entry.site.deleted || entry.site.price !== entry.lastPrice || entry.site.oldPrice !== entry.price || entry.site.discount !== entry.discount || !entry.site.promotion || !entry.site.model) } : {}),
}, null, 2));

await closeDb();
