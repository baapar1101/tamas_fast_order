import { and, asc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import {
  PRICE_LISTS_SETTING_KEY,
  parsePriceListsConfig,
  type PriceListDTO,
  type PriceListDefinition,
  type PriceListSummary,
  type PriceListsConfig,
} from '@tamas/shared';
import { db } from '../db/client.js';
import { brands, categories, products } from '../db/schema.js';
import { getSetting, setSetting } from './settings.js';

export async function getPriceListsConfig(): Promise<PriceListsConfig> {
  return parsePriceListsConfig(await getSetting(PRICE_LISTS_SETTING_KEY));
}

export async function savePriceListsConfig(config: PriceListsConfig): Promise<void> {
  await setSetting(PRICE_LISTS_SETTING_KEY, JSON.stringify(config));
}

function listFilter(list: PriceListDefinition): SQL | null {
  if (!list.categoryNames.length) return null;
  const filters: SQL[] = [
    isNull(products.deletedAt),
    eq(products.status, 'active'),
    sql`${products.price} > 0`,
    or(inArray(categories.name, list.categoryNames), inArray(categories.faName, list.categoryNames))!,
  ];
  if (list.brandNames.length) filters.push(or(inArray(brands.name, list.brandNames), inArray(brands.faName, list.brandNames))!);
  if (list.inStockOnly) filters.push(sql`(${products.stock} + ${products.kermanStock} + ${products.tehranStock}) > 0`);
  return and(...filters)!;
}

export async function priceListSummaries(): Promise<PriceListSummary[]> {
  const config = await getPriceListsConfig();
  const lists = config.lists.filter((list) => list.enabled);
  return Promise.all(lists.map(async (list) => {
    const where = listFilter(list);
    if (!where) return { id: list.id, title: list.title, count: 0 };
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(where);
    return { id: list.id, title: list.title, count: row?.n ?? 0 };
  }));
}

/**
 * One list, grouped by brand in the panel's brand order. Prices go only to
 * approved partners, the same rule as the storefront.
 */
export async function priceList(id: string, options: { showPrices: boolean }): Promise<PriceListDTO | null> {
  const config = await getPriceListsConfig();
  const list = config.lists.find((item) => item.id === id && item.enabled);
  if (!list) return null;
  const where = listFilter(list);
  const rows = where
    ? await db
      .select({
        productId: products.productId,
        title: products.title,
        color: products.color,
        price: products.price,
        stock: sql<number>`(${products.stock} + ${products.kermanStock} + ${products.tehranStock})::int`,
        updatedAt: products.updatedAt,
        brand: sql<string>`coalesce(${brands.faName}, ${brands.name}, 'سایر')`,
        brandOrder: sql<number>`coalesce(${brands.sortOrder}, 100000)`,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(where)
      .orderBy(sql`coalesce(${brands.sortOrder}, 100000)`, asc(brands.faName), asc(products.title), asc(products.color))
    : [];
  const groups: PriceListDTO['groups'] = [];
  let updatedAt = 0;
  for (const row of rows) {
    updatedAt = Math.max(updatedAt, row.updatedAt.getTime());
    let group = groups.at(-1);
    if (!group || group.brand !== row.brand) {
      group = { brand: row.brand, rows: [] };
      groups.push(group);
    }
    group.rows.push({
      productId: row.productId,
      title: row.title,
      color: row.color,
      price: options.showPrices ? row.price : null,
      inStock: row.stock > 0,
    });
  }
  return {
    id: list.id,
    title: list.title,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
    pricesHidden: !options.showPrices,
    groups,
  };
}
