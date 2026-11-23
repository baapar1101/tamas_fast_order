import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { ProductWrite } from '@tamas/shared';
import { db } from '../db/client.js';
import { brands, categories, products } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { buildSearchText } from './catalog.js';
import { enqueueCrmProductSync } from './crm-product-sync.js';

type TaxonomyTable = typeof categories | typeof brands;

/**
 * The form two spellings of one name share: "HOCO", "hoco", "Ho-co" and
 * "هوکو" with Arabic ي/ك all compare equal once spaces, dashes and
 * zero-width joiners are gone.
 */
export function taxonomyKey(name: string): string {
  return name.normalize('NFKC').toLowerCase()
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\s\u200c\u200d_.-]+/g, '');
}

const SQL_KEY_PATTERN = '[[:space:]\u200c\u200d_.-]+';
function sqlKey(column: typeof categories.name | typeof brands.name | typeof categories.faName | typeof brands.faName) {
  return sql`regexp_replace(translate(lower(${column}), 'يك', 'یک'), ${SQL_KEY_PATTERN}, '', 'g')`;
}

/**
 * Finds a category/brand by its English or Persian name, ignoring case,
 * spaces and Arabic letter forms; live rows win over deleted ones. Never
 * creates one.
 */
export async function findTaxonomyId(
  table: TaxonomyTable,
  name: string | null | undefined,
  options: { liveOnly?: boolean } = {},
): Promise<number | null> {
  return (await findTaxonomy(table, name, options))?.id ?? null;
}

async function findTaxonomy(
  table: TaxonomyTable,
  name: string | null | undefined,
  options: { liveOnly?: boolean } = {},
): Promise<{ id: number; deleted: boolean } | null> {
  const clean = String(name ?? '').trim();
  if (!clean) return null;
  const key = taxonomyKey(clean);
  const byName = or(eq(table.name, clean), eq(table.faName, clean), eq(sqlKey(table.name), key), eq(sqlKey(table.faName), key));
  const [found] = await db
    .select({ id: table.id, deletedAt: table.deletedAt })
    .from(table)
    .where(options.liveOnly ? and(byName, isNull(table.deletedAt)) : byName)
    .orderBy(sql`${table.deletedAt} is not null`, table.id)
    .limit(1);
  return found ? { id: found.id, deleted: found.deletedAt !== null } : null;
}

/** Resolves a category/brand name to its id, reviving a deleted match or creating the row when new. */
export async function resolveTaxonomy(table: TaxonomyTable, name: string | null | undefined): Promise<number | null> {
  const clean = String(name ?? '').trim();
  if (!clean) return null;
  const found = await findTaxonomy(table, clean);
  if (found?.deleted) {
    await db.update(table).set({ deletedAt: null, updatedAt: new Date() }).where(eq(table.id, found.id));
  }
  if (found) return found.id;
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
