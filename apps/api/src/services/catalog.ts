import { and, asc, count, desc, eq, gt, inArray, isNull, not, or, sql, type SQL } from 'drizzle-orm';
import type { BrandDTO, BundleContentDTO, CatalogQuery, CategoryDTO, ColorDTO, ProductDTO, ProductGroupDTO } from '@tamas/shared';
import { db } from '../db/client.js';
import { brands, categories, categoryBrands, colors, products } from '../db/schema.js';
import { catalogCache } from '../lib/cache.js';
import { sanitizeExternalText } from '../lib/external-content.js';
import { resolveBundleContents } from './bundle-contents.js';
import { offsetOf } from '../lib/pagination.js';
import { jsonArray, productAttributes, productGallery } from '../lib/catalog-json.js';
import { getSetting } from './settings.js';
import { applyFlashSale, flashSaleCacheTag, getFlashSaleConfig } from './flash-sale.js';

type ProductRow = typeof products.$inferSelect;

export function toProductDTO(
  row: ProductRow,
  category?: { name: string; faName: string } | null,
  brand?: { name: string; faName: string } | null,
  options: { includeAdminSource?: boolean } = {},
): ProductDTO {
  const dto: ProductDTO = {
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    title: sanitizeExternalText(row.title),
    model: row.model ? sanitizeExternalText(row.model) : null,
    categoryName: category?.name ?? null,
    categoryFaName: category?.faName ?? null,
    brandName: brand?.name ?? null,
    brandFaName: brand?.faName ?? null,
    parentProductId: row.parentProductId ?? null,
    otherStocks: row.otherStocks && typeof row.otherStocks === 'object' && !Array.isArray(row.otherStocks) ? row.otherStocks : {},
    color: row.color ? sanitizeExternalText(row.color) : null,
    colorEn: row.colorEn ? sanitizeExternalText(row.colorEn) : null,
    colorCode: row.colorCode,
    price: row.price,
    oldPrice: row.oldPrice,
    discount: row.discount,
    stock: row.stock,
    kermanStock: row.kermanStock,
    tehranStock: row.tehranStock,
    warranty: row.warranty ? sanitizeExternalText(row.warranty) : null,
    sellType: row.sellType ? sanitizeExternalText(row.sellType) : null,
    seller: row.seller ? sanitizeExternalText(row.seller) : null,
    promotion: row.promotion,
    status: row.status,
    subTitle: row.subTitle ? sanitizeExternalText(row.subTitle) : null,
    description: sanitizeExternalText(row.description) || null,
    keywords: row.keywords ? sanitizeExternalText(row.keywords) : null,
    slug: row.slug,
    ribbon: row.ribbon ? sanitizeExternalText(row.ribbon) : null,
    type: row.type,
    weight: row.weight,
    dimensions: row.dimensions ? sanitizeExternalText(row.dimensions) : null,
    tracking: row.tracking,
    imageUrl: row.imageUrl,
    gallery: productGallery(row.gallery),
    attributes: productAttributes(row.attributes).map((attribute) => ({
      key: sanitizeExternalText(attribute.key),
      value: sanitizeExternalText(attribute.value),
    })),
    rating: row.rating,
    ratingCount: row.ratingCount,
    externalDataUpdatedAt: row.externalDataUpdatedAt?.toISOString() ?? null,
    bundleItems: jsonArray(row.bundleItems) as ProductDTO['bundleItems'],
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (options.includeAdminSource) {
    const units = availableStock(row);
    dto.costPrice = row.costPrice;
    dto.inventoryValue = units * row.costPrice;
    dto.digikalaLink = row.digikalaLink ?? null;
    dto.targetSiteUrl = row.targetSiteUrl ?? null;
  }
  return dto;
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

/**
 * The default storefront order. Within each category, models are ranked:
 * with a photo first, real brands before generic «متفرقه», the admin's product
 * order, then the more valuable models. Pages then interleave the categories
 * (each category's best model in the admin's category order, then each one's
 * second best, …) so the catalog opens on a varied, premium mix instead of a
 * wall of cheap adapters or of one category.
 */
async function featuredTitles(where: SQL | undefined, groupKeyExpr: SQL<string>, limit: number, offset: number): Promise<Array<{ title: string }>> {
  const rows = await db.execute(sql`
    with g as (
      select ${groupKeyExpr} as title,
        max(case when coalesce(${products.imageUrl}, '') <> '' then 1 else 0 end) as has_image,
        min(coalesce(${categories.sortOrder}, 9999)) as category_order,
        min(coalesce(${products.categoryId}, 0)) as category_id,
        max(case when ${brands.name} = 'OTHER' or ${brands.faName} = 'متفرقه' then 1 else 0 end) as generic,
        min(${products.sortOrder}) as manual_order,
        coalesce(min(nullif(${products.price}, 0)), 0) as price
      from ${products}
      left join ${categories} on ${categories.id} = ${products.categoryId}
      left join ${brands} on ${brands.id} = ${products.brandId}
      where ${where ?? sql`true`}
      group by 1
    ), ranked as (
      select title, has_image, category_order,
        row_number() over (partition by category_id, has_image order by generic, manual_order, price desc, title) as rank_in_category
      from g
    )
    select title from ranked
    order by has_image desc, rank_in_category, category_order, title
    limit ${limit} offset ${offset}
  `);
  return rows as unknown as Array<{ title: string }>;
}

export async function queryProducts(q: CatalogQuery): Promise<{
  groups: ProductGroupDTO[];
  total: number;
  page: number;
  perPage: number;
}> {
  const campaignActive = (await getSetting('campaign_mode'))?.startsWith('2026-11') ?? false;
  const flashSale = await getFlashSaleConfig();
  const saleNow = new Date();
  const cacheKey = `products:${campaignActive}:${flashSaleCacheTag(flashSale, saleNow)}:${JSON.stringify(q)}`;
  const cached = catalogCache.get(cacheKey) as
    | { groups: ProductGroupDTO[]; total: number; page: number; perPage: number }
    | undefined;
  if (cached) return cached;

  const filters = [q.inStock ? sellableProduct() : liveProduct()];
  if (campaignActive && q.inStock) filters.push(eq(products.promotion, true));
  const isBasket = or(eq(categories.name, 'Bondle'), eq(categories.faName, 'سبد ها'))!;
  if (q.promotion && !q.basketOnly) filters.push(and(eq(products.promotion, true), or(isNull(products.categoryId), not(isBasket)))!);
  if (q.basketOnly) filters.push(and(isBasket, eq(products.promotion, true))!);
  if (q.creditOnly) {
    filters.push(
      or(
        sql`${products.sellType} ILIKE ${'%چک%'}`,
        sql`${products.sellType} ILIKE ${'%اعتبار%'}`,
      )!,
    );
  }
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
  const groupKeyExpr = sql<string>`COALESCE(NULLIF(${products.parentProductId}, ''), ${products.title})`;

  // Order the complete model set before slicing pages. Sorting only the rows
  // on the current alphabetical page makes price/newest filters misleading.
  const modelPrice = sql`coalesce(min(nullif(${products.price}, 0)), 0)`;
  const orderings = q.sort === 'price_asc' ? [asc(modelPrice)]
    : q.sort === 'price_desc' ? [desc(modelPrice)]
    : q.sort === 'newest' ? [desc(sql`max(${products.createdAt})`)]
    : [];
  const titleRows = q.sort === 'featured'
    ? await featuredTitles(where, groupKeyExpr, q.perPage, offsetOf(q))
    : await db
      .select({ title: groupKeyExpr })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(where)
      .groupBy(groupKeyExpr)
      .orderBy(...orderings, asc(groupKeyExpr))
      .limit(q.perPage)
      .offset(offsetOf(q));

  const [totalRow] = await db
    .select({ n: sql<number>`count(distinct COALESCE(NULLIF(${products.parentProductId}, ''), ${products.title}))::int` })
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
    const dto = applyFlashSale(toProductDTO(row.product, row.category, row.brand), flashSale, saleNow);
    if (campaignActive && !dto.promotion) {
      dto.stock = 0;
      dto.kermanStock = 0;
      dto.tehranStock = 0;
    }
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
      byTitle.set(groupKey, group);
    }
    group.variants.push(dto);
    group.promotion ||= dto.promotion;
    if (dto.price > 0) group.minPrice = Math.min(group.minPrice, dto.price);
    group.imageUrl ||= dto.imageUrl;
  }

  const groups = titles.map((t) => byTitle.get(t)).filter((g): g is ProductGroupDTO => Boolean(g));
  for (const g of groups) if (g.minPrice === Number.MAX_SAFE_INTEGER) g.minPrice = 0;

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

export async function findProductByPublicId(
  productId: string,
  options: { adminPreview?: boolean } = {},
): Promise<{ product: ProductDTO; variants: ProductDTO[]; bundleContents: BundleContentDTO[] } | null> {
  // A direct product URL remains useful when stock runs out. Only the private
  // admin preview may include inactive products; deleted products stay hidden.
  const visibleProduct = options.adminPreview ? isNull(products.deletedAt) : liveProduct();
  const shortCode = /^~([0-9a-z]+)$/i.exec(productId);
  const shortId = shortCode ? Number.parseInt(shortCode[1]!, 36) : null;
  if (shortCode && (!Number.isSafeInteger(shortId) || shortId! <= 0)) return null;
  const [row] = await db
    .select({
      product: products,
      category: { name: categories.name, faName: categories.faName },
      brand: { name: brands.name, faName: brands.faName },
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(and(shortId ? eq(products.id, shortId) : eq(products.productId, productId), visibleProduct))
    .limit(1);

  if (!row) return null;

  const campaignActive = !options.adminPreview && ((await getSetting('campaign_mode'))?.startsWith('2026-11') ?? false);
  const flashSale = await getFlashSaleConfig();
  const saleNow = new Date();
  const maskUnavailable = (dto: ProductDTO): ProductDTO => {
    const product = applyFlashSale(dto, flashSale, saleNow);
    return campaignActive && !product.promotion ? { ...product, stock: 0, kermanStock: 0, tehranStock: 0 } : product;
  };
  const mainProduct = maskUnavailable(toProductDTO(row.product, row.category, row.brand));
  let bundleContents: BundleContentDTO[] = [];
  if (mainProduct.bundleItems.length > 0) {
    const productIds = [...new Set(mainProduct.bundleItems.map((item) => item.productId))];
    const componentRows = await db
      .select({ productId: products.productId, title: products.title, imageUrl: products.imageUrl })
      .from(products)
      .where(and(inArray(products.productId, productIds), isNull(products.deletedAt)));
    bundleContents = resolveBundleContents(
      mainProduct.bundleItems,
      componentRows.map((item) => ({
        productId: item.productId,
        title: sanitizeExternalText(item.title),
        imageUrl: item.imageUrl,
      })),
    );
  }
  
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
        visibleProduct,
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

  const variants = variantRows.map((r) => maskUnavailable(toProductDTO(r.product, r.category, r.brand)));

  return { product: mainProduct, variants, bundleContents };
}

/** Every write path calls this so the storefront never serves a stale page. */
export function invalidateCatalog(): void {
  catalogCache.clear();
}

export { desc };
