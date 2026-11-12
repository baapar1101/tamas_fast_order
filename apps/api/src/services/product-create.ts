import { and, eq, isNull, or } from 'drizzle-orm';
import type { ProductWrite } from '@tamas/shared';
import { db } from '../db/client.js';
import { brands, categories, products } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { buildSearchText } from './catalog.js';
import { enqueueCrmProductSync } from './crm-product-sync.js';

type TaxonomyTable = typeof categories | typeof brands;

/** Finds a category/brand by its English or Persian name; never creates one. */
export async function findTaxonomyId(
  table: TaxonomyTable,
  name: string | null | undefined,
  options: { liveOnly?: boolean } = {},
): Promise<number | null> {
  const clean = String(name ?? '').trim();
  if (!clean) return null;
  const byName = or(eq(table.name, clean), eq(table.faName, clean));
  const [found] = await db
    .select({ id: table.id })
    .from(table)
    .where(options.liveOnly ? and(byName, isNull(table.deletedAt)) : byName)
    .limit(1);
  return found?.id ?? null;
}

/** Resolves a category/brand name to its id, creating the row when new. */
export async function resolveTaxonomy(table: TaxonomyTable, name: string | null | undefined): Promise<number | null> {
  const clean = String(name ?? '').trim();
  if (!clean) return null;
  const found = await findTaxonomyId(table, clean);
  if (found) return found;
  const [created] = await db.insert(table).values({ name: clean, faName: clean }).returning({ id: table.id });
  return created?.id ?? null;
}

/** Bundle products belong in the storefront's basket category even when the editor omits it. */
export async function resolveProductCategory(name: string | null | undefined, type: string): Promise<number | null> {
  if (name?.trim()) return resolveTaxonomy(categories, name);
  return basketCategoryFor(type);
}

export async function basketCategoryFor(type: string): Promise<number | null> {
  if (type !== 'bundle') return null;
  const [basket] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(or(eq(categories.name, 'Bondle'), eq(categories.faName, 'سبد ها')))
    .limit(1);
  if (!basket) throw badRequest('دسته‌بندی «سبد ها» برای باندل تعریف نشده است.');
  return basket.id;
}

/**
 * Inserts a validated product (title already formatted, duplicates already
 * ruled out) and queues it for the CRM. Callers handle tracking links,
 * catalogue cache and audit.
 */
export async function insertProductRecord(
  body: ProductWrite,
  ids: { categoryId: number | null; brandId: number | null; targetSiteUrl?: string | null },
): Promise<typeof products.$inferSelect> {
  const { categoryName: _c, brandName: _b, trackingLinks: _links, ...rest } = body;
  const [created] = await db
    .insert(products)
    .values({
      ...rest,
      targetSiteUrl: ids.targetSiteUrl ?? rest.targetSiteUrl ?? null,
      // The per-warehouse counts are optional in the form but NOT NULL in the
      // table; a blank field means zero, not "unknown".
      kermanStock: rest.kermanStock ?? 0,
      tehranStock: rest.tehranStock ?? 0,
      categoryId: ids.categoryId,
      brandId: ids.brandId,
      searchText: buildSearchText([
        body.title,
        body.subTitle,
        body.model,
        body.brandName,
        body.color,
        body.colorEn,
        body.sku,
        body.productId,
      ]),
    })
    .returning();
  if (!created) throw badRequest('ثبت محصول ناموفق بود.');
  await enqueueCrmProductSync(created.productId, 'create');
  return created;
}
