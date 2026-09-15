import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import type { BrandDTO, CatalogQuery, CategoryDTO, ColorDTO, ProductDTO, ProductGroupDTO } from '@tamas/shared';
import { db } from '../db/client.js';
import { brands, categories, categoryBrands, colors, products } from '../db/schema.js';
import { catalogCache } from '../lib/cache.js';
import { offsetOf } from '../lib/pagination.js';

type ProductRow = typeof products.$inferSelect;

export function toProductDTO(
  row: ProductRow,
  category?: { name: string; faName: string } | null,
  brand?: { name: string; faName: string } | null,
): ProductDTO {
  return {
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    title: row.title,
    model: row.model,
    categoryName: category?.name ?? null,
    categoryFaName: category?.faName ?? null,
    brandName: brand?.name ?? null,
    brandFaName: brand?.faName ?? null,
    parentProductId: row.parentProductId ?? null,
    otherStocks: row.otherStocks ?? {},
    color: row.color,
    colorEn: row.colorEn,
    colorCode: row.colorCode,
    price: row.price,
    oldPrice: row.oldPrice,
    discount: row.discount,
    stock: row.stock,
    kermanStock: row.kermanStock,
    tehranStock: row.tehranStock,
    warranty: row.warranty,
    sellType: row.sellType,
    seller: row.seller,
    promotion: row.promotion,
    status: row.status,
    subTitle: row.subTitle,
    description: row.description,
    keywords: row.keywords,
    slug: row.slug,
    ribbon: row.ribbon,
    type: row.type,
    weight: row.weight,
    dimensions: row.dimensions,
    tracking: row.tracking,
    imageUrl: row.imageUrl,
    gallery: row.gallery ?? [],
    attributes: row.attributes ?? [],
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Total sellable units — the two warehouses when set, otherwise the flat count. */
export function availableStock(p: Pick<ProductRow, 'kermanStock' | 'tehranStock' | 'stock'>): number {
  const split = p.kermanStock + p.tehranStock;
  return split > 0 ? split : p.stock;
}

/** Lowercase haystack kept on the row so search is one indexed ILIKE. */
export function buildSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .slice(0, 2000);
}

const liveProduct = () => and(isNull(products.deletedAt), eq(products.status, 'active'));

/** Public storefront rows must have both a sellable price and available stock. */
const sellableProduct = () =>
  and(
    liveProduct(),
    gt(products.price, 0),
    or(gt(products.stock, 0), gt(products.kermanStock, 0), gt(products.tehranStock, 0)),
  );

export async function queryProducts(q: CatalogQuery): Promise<{
  groups: ProductGroupDTO[];
  total: number;
  page: number;
  perPage: number;
}> {
  const cacheKey = `products:${JSON.stringify(q)}`;
  const cached = catalogCache.get(cacheKey) as
    | { groups: ProductGroupDTO[]; total: number; page: number; perPage: number }
    | undefined;
  if (cached) return cached;

  const filters = [sellableProduct()];
  if (q.promotion) filters.push(eq(products.promotion, true));
  if (q.q) filters.push(sql`${products.searchText} like ${'%' + q.q.toLowerCase() + '%'}`);
  if (q.category) {
    filters.push(or(eq(categories.name, q.category), eq(categories.faName, q.category))!);
  }
  if (q.brands.length > 0) {
    // Filters arrive as either the English key or the Persian label.
    filters.push(or(inArray(brands.name, q.brands), inArray(brands.faName, q.brands))!);
  }

  const where = and(...filters);

  /*
   * The storefront shows one card per model with a row per colour, so pagination
   * has to count models rather than rows: page the distinct titles first, then
   * fetch every variant belonging to that page.
   */
  const groupKeyExpr = sql<string>`COALESCE(${products.parentProductId}, ${products.title})`;

  const titleRows = await db
    .selectDistinct({ title: groupKeyExpr })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(where)
    .orderBy(q.sort === 'title' ? asc(groupKeyExpr) : asc(groupKeyExpr))
    .limit(q.perPage)
    .offset(offsetOf(q));

  const [totalRow] = await db
    .select({ n: sql<number>`count(distinct COALESCE(${products.parentProductId}, ${products.title}))::int` })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(where);

  const titles = titleRows.map((r) => r.title);
  if (titles.length === 0) {
    const empty = { groups: [], total: totalRow?.n ?? 0, page: q.page, perPage: q.perPage };
    catalogCache.set(cacheKey, empty);
    return empty;
  }

  const variantRows = await db
    .select({
      product: products,
      category: { name: categories.name, faName: categories.faName },
      brand: { name: brands.name, faName: brands.faName },
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(and(where, inArray(groupKeyExpr, titles)))
    .orderBy(asc(products.sortOrder), asc(products.price));

  const byTitle = new Map<string, ProductGroupDTO>();
  for (const row of variantRows) {
    const dto = toProductDTO(row.product, row.category, row.brand);
    const groupKey = row.product.parentProductId || dto.title;
    let group = byTitle.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        title: dto.title,
        imageUrl: dto.imageUrl,
        promotion: false,
        minPrice: Number.MAX_SAFE_INTEGER,
        variants: [],
      };
      byTitle.set(dto.title, group);
    }
    group.variants.push(dto);
    group.promotion ||= dto.promotion;
    group.minPrice = Math.min(group.minPrice, dto.price);
    group.imageUrl ||= dto.imageUrl;
  }

  const groups = titles.map((t) => byTitle.get(t)).filter((g): g is ProductGroupDTO => Boolean(g));
  for (const g of groups) if (g.minPrice === Number.MAX_SAFE_INTEGER) g.minPrice = 0;

  if (q.sort === 'price_asc') groups.sort((a, b) => a.minPrice - b.minPrice);
  else if (q.sort === 'price_desc') groups.sort((a, b) => b.minPrice - a.minPrice);
  else if (q.sort === 'title') groups.sort((a, b) => a.title.localeCompare(b.title, 'fa'));

  const result = { groups, total: totalRow?.n ?? groups.length, page: q.page, perPage: q.perPage };
  catalogCache.set(cacheKey, result);
  return result;
}

export async function listCategories(): Promise<CategoryDTO[]> {
  return catalogCache.wrap('categories', async () => {
    const rows = await db
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.faName));

    const links = await db
      .select({ categoryId: categoryBrands.categoryId, brandName: brands.name, brandFaName: brands.faName })
      .from(categoryBrands)
      .innerJoin(brands, eq(brands.id, categoryBrands.brandId));

    const counts = await db
      .select({ categoryId: products.categoryId, n: count() })
      .from(products)
      .where(sellableProduct())
      .groupBy(products.categoryId);

    const countMap = new Map(counts.map((c) => [c.categoryId, Number(c.n)]));
    const linkMap = new Map<number, string[]>();
    for (const l of links) {
      const list = linkMap.get(l.categoryId) ?? [];
      list.push(l.brandFaName || l.brandName);
      linkMap.set(l.categoryId, list);
    }

    return rows.map<CategoryDTO>((r) => ({
      id: r.id,
      name: r.name,
      faName: r.faName,
      iconUrl: r.iconUrl,
      sortOrder: r.sortOrder,
      brandNames: linkMap.get(r.id) ?? [],
      productCount: countMap.get(r.id) ?? 0,
    }));
  }) as Promise<CategoryDTO[]>;
}

export async function listBrands(): Promise<BrandDTO[]> {
  return catalogCache.wrap('brands', async () => {
    const rows = await db
      .select()
      .from(brands)
      .where(isNull(brands.deletedAt))
      .orderBy(asc(brands.sortOrder), asc(brands.faName));

    const counts = await db
      .select({ brandId: products.brandId, n: count() })
      .from(products)
      .where(sellableProduct())
      .groupBy(products.brandId);
    const countMap = new Map(counts.map((c) => [c.brandId, Number(c.n)]));

    return rows.map<BrandDTO>((r) => ({
      id: r.id,
      name: r.name,
      faName: r.faName,
      iconUrl: r.iconUrl,
      sortOrder: r.sortOrder,
      productCount: countMap.get(r.id) ?? 0,
    }));
  }) as Promise<BrandDTO[]>;
}

export async function listColors(): Promise<ColorDTO[]> {
  return catalogCache.wrap('colors', async () => {
    const rows = await db.select().from(colors).where(isNull(colors.deletedAt)).orderBy(asc(colors.code));
    return rows.map<ColorDTO>((r) => ({ id: r.id, code: r.code, name: r.name, faName: r.faName }));
  }) as Promise<ColorDTO[]>;
}

export async function findProductByPublicId(productId: string): Promise<{ product: ProductDTO; variants: ProductDTO[] } | null> {
  const [row] = await db
    .select({
      product: products,
      category: { name: categories.name, faName: categories.faName },
      brand: { name: brands.name, faName: brands.faName },
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(and(eq(products.productId, productId), sellableProduct()))
    .limit(1);

  if (!row) return null;

  const mainProduct = toProductDTO(row.product, row.category, row.brand);
  
  // Find variants: either sharing the same parentProductId, or the same title as fallback
  const variantRows = await db
    .select({
      product: products,
      category: { name: categories.name, faName: categories.faName },
      brand: { name: brands.name, faName: brands.faName },
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(
      and(
        sellableProduct(),
        or(
          row.product.parentProductId
            ? eq(products.parentProductId, row.product.parentProductId)
            : or(
                eq(products.parentProductId, row.product.productId),
                eq(products.title, row.product.title)
              )
        )
      )
    );

  const variants = variantRows.map((r) => toProductDTO(r.product, r.category, r.brand));

  return { product: mainProduct, variants };
}

/** Every write path calls this so the storefront never serves a stale page. */
export function invalidateCatalog(): void {
  catalogCache.clear();
}

export { desc };
