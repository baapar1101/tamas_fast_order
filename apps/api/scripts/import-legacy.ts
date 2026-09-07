/**
 * Loads the old `legacy/catalog_backup.json` (the snapshot the Apps Script
 * build fell back to) into Postgres. Safe to run more than once: every row is
 * an upsert keyed the same way the sheet keys it.
 *
 *   npm run import:legacy -- --file ../../legacy/catalog_backup.json
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { normalizePhone } from '@tamas/shared';
import { closeDb, db } from '../src/db/client.js';
import { brands, categories, categoryBrands, colors, products, settings, users } from '../src/db/schema.js';
import { buildSearchText } from '../src/services/catalog.js';

const argv = process.argv.slice(2);
const fileArg = argv.indexOf('--file');
const file = fileArg >= 0 ? argv[fileArg + 1] : '../../legacy/catalog_backup.json';

const str = (v: unknown): string => (v == null ? '' : String(v).trim());
const num = (v: unknown): number => {
  const n = Number(str(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const bool = (v: unknown): boolean => {
  const s = str(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'بله';
};

const splitList = (v: unknown): string[] =>
  str(v)
    .split(/[,،;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

interface LegacyCatalog {
  products?: Array<Record<string, unknown>>;
  categories?: Array<Record<string, unknown>>;
  brands?: Array<Record<string, unknown>>;
  colors?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown> | Array<Record<string, unknown>>;
  users?: Array<Record<string, unknown>>;
  catalog?: LegacyCatalog;
}

async function main(): Promise<void> {
  const path = resolve(process.cwd(), file!);
  console.log(`reading ${path}`);
  const parsed = JSON.parse(await readFile(path, 'utf8')) as LegacyCatalog;
  // exportAll snapshots nest the catalogue one level down.
  const data = parsed.catalog ?? parsed;

  /* ---------- brands ---------- */
  const brandRows = data.brands ?? [];
  const brandIds = new Map<string, number>();
  for (const b of brandRows) {
    const name = str(b.brand_name ?? b.name);
    if (!name) continue;
    const [row] = await db
      .insert(brands)
      .values({
        name,
        faName: str(b.brand_fa_name ?? b.faName) || name,
        iconUrl: str(b.icon_url) || null,
      })
      .onConflictDoUpdate({
        target: brands.name,
        set: { faName: str(b.brand_fa_name ?? b.faName) || name, iconUrl: str(b.icon_url) || null },
      })
      .returning({ id: brands.id });
    if (row) {
      brandIds.set(name.toLowerCase(), row.id);
      const fa = str(b.brand_fa_name ?? b.faName);
      if (fa) brandIds.set(fa.toLowerCase(), row.id);
    }
  }
  console.log(`✅ brands: ${brandRows.length}`);

  /* ---------- categories ---------- */
  const categoryRows = data.categories ?? [];
  const categoryIds = new Map<string, number>();
  for (const c of categoryRows) {
    const name = str(c.category_name ?? c.name);
    if (!name) continue;
    const faName = str(c.category_fa_name ?? c.faName) || name;
    const [row] = await db
      .insert(categories)
      .values({ name, faName, iconUrl: str(c.icon_url) || null })
      .onConflictDoUpdate({ target: categories.name, set: { faName, iconUrl: str(c.icon_url) || null } })
      .returning({ id: categories.id });
    if (!row) continue;
    categoryIds.set(name.toLowerCase(), row.id);
    if (faName) categoryIds.set(faName.toLowerCase(), row.id);

    // The legacy `Brand` column held a comma list of brands for the category.
    const linked = splitList(c.Brand ?? c.brand);
    await db.delete(categoryBrands).where(eq(categoryBrands.categoryId, row.id));
    const ids = linked.map((n) => brandIds.get(n.toLowerCase())).filter((v): v is number => typeof v === 'number');
    if (ids.length > 0) {
      await db
        .insert(categoryBrands)
        .values([...new Set(ids)].map((brandId) => ({ categoryId: row.id, brandId })))
        .onConflictDoNothing();
    }
  }
  console.log(`✅ categories: ${categoryRows.length}`);

  /* ---------- colors ---------- */
  const colorRows = data.colors ?? [];
  for (const c of colorRows) {
    const code = str(c.color_code ?? c.code);
    if (!code) continue;
    await db
      .insert(colors)
      .values({ code, faName: str(c.color_fa_name ?? c.faName) || null, name: str(c.color_name ?? c.name) || null })
      .onConflictDoUpdate({
        target: colors.code,
        set: { faName: str(c.color_fa_name ?? c.faName) || null, name: str(c.color_name ?? c.name) || null },
      });
  }
  console.log(`✅ colors: ${colorRows.length}`);

  /* ---------- products ---------- */
  const productRows = data.products ?? [];
  let imported = 0;
  let skipped = 0;

  for (const p of productRows) {
    const productId = str(p.product_id ?? p.productId ?? p.sku);
    if (!productId) {
      skipped += 1;
      continue;
    }

    const title = str(p.title) || str(p.model) || productId;
    const brandName = str(p.Brand ?? p.brand);
    const categoryName = str(p.Category ?? p.category);
    const attrKey = str(p.attribute_key);
    const attrValue = str(p.attribute_value);
    const attrKeys = attrKey ? attrKey.split('|').map((s) => s.trim()).filter(Boolean) : [];
    const attrValues = attrValue ? attrValue.split('|').map((s) => s.trim()) : [];

    const values = {
      productId,
      sku: str(p.sku) || null,
      title,
      model: str(p.model) || null,
      categoryId: categoryIds.get(categoryName.toLowerCase()) ?? null,
      brandId: brandIds.get(brandName.toLowerCase()) ?? null,
      color: str(p.color) || null,
      colorEn: str(p.color_en) || null,
      colorCode: str(p.color_code) || null,
      price: num(p.price),
      oldPrice: str(p.old_price) ? num(p.old_price) : null,
      discount: num(p.discount),
      stock: num(p.stock),
      kermanStock: num(p.kerman_stock),
      tehranStock: num(p.tehran_stock),
      warranty: str(p.warranty) || null,
      sellType: str(p.sell_type) || null,
      seller: str(p.seller) || null,
      promotion: bool(p.promotion),
      // The old sheet wrote "Not Active" as free text in the status column.
      status: (str(p.status).toLowerCase().replace(/\s+/g, '') === 'notactive' ? 'inactive' : 'active') as
        | 'active'
        | 'inactive',
      imageUrl: str(p.image_url) || null,
      gallery: [] as string[],
      attributes: attrKeys.map((k, i) => ({ key: k, value: attrValues[i] ?? '' })),
      sortOrder: 0,
      searchText: buildSearchText([title, str(p.model), brandName, str(p.color), str(p.color_en), str(p.sku), productId]),
    };

    await db
      .insert(products)
      .values(values)
      .onConflictDoUpdate({ target: products.productId, set: { ...values, updatedAt: new Date() } });
    imported += 1;
  }
  console.log(`✅ products: ${imported} imported, ${skipped} skipped (no product_id)`);

  /* ---------- users ---------- */
  const userRows = data.users ?? [];
  for (const u of userRows) {
    const phone = normalizePhone(u.mobile_number ?? u.phone);
    if (!/^09\d{9}$/.test(phone)) continue;
    const values = {
      phone,
      name: str(u.name),
      lastName: str(u.last_name),
      storeName: str(u.Store_name ?? u.store_name),
      landline: str(u.phone_number),
      address: str(u.address),
      postalCode: str(u.postal_code),
      certificateFileUrl: str(u.certificate_file_url),
      isActive: bool(u.actived ?? u.is_active),
    };
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.phone, set: values });
  }
  console.log(`✅ users: ${userRows.length}`);

  /* ---------- settings ---------- */
  const rawSettings = data.settings;
  const entries: Array<[string, string]> = Array.isArray(rawSettings)
    ? rawSettings.map((s) => [str(s.key), str(s.value)])
    : Object.entries(rawSettings ?? {}).map(([k, v]) => [k, str(v)]);
  for (const [key, value] of entries) {
    if (!key) continue;
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  }
  console.log(`✅ settings: ${entries.length}`);

  await closeDb();
  console.log('\nDone. Run `npm run sync:push` to mirror this into Google Sheets.');
}

main().catch(async (err) => {
  console.error('❌ import failed:', err);
  await closeDb().catch(() => {});
  process.exit(1);
});
