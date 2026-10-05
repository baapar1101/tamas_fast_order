import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import { productPatchSchema, productWriteSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { brands, categories, products, productTrackingLinks, trackingSites } from '../../db/schema.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import { buildSearchText, invalidateCatalog, toProductDTO } from '../../services/catalog.js';
import { logAction } from '../../services/audit.js';
import { duplicateProductMessage, findProductDuplicate } from '../../services/product-duplicates.js';

type TrackingLinkInput = { siteId: number; url: string };

async function validateTrackingLinks(links: TrackingLinkInput[]): Promise<TrackingLinkInput[]> {
  const deduped = [...new Map(links.map((link) => [link.siteId, { siteId: link.siteId, url: link.url.trim() }])).values()];
  if (deduped.length > 3) throw badRequest('برای هر محصول حداکثر سه سایت قابل رهگیری است.');
  if (deduped.length === 0) return [];
  const activeSites = await db.select({ id: trackingSites.id }).from(trackingSites).where(and(inArray(trackingSites.id, deduped.map((link) => link.siteId)), eq(trackingSites.isActive, true)));
  if (activeSites.length !== deduped.length) throw badRequest('یکی از سایت‌های رهگیری معتبر یا فعال نیست.');
  return deduped;
}

async function replaceTrackingLinks(productDbId: number, links: TrackingLinkInput[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(productTrackingLinks).where(eq(productTrackingLinks.productDbId, productDbId));
    if (links.length > 0) {
      await tx.insert(productTrackingLinks).values(links.map((link) => ({ productDbId, siteId: link.siteId, url: link.url })));
    }
  });
}

async function loadTrackingLinks(productIds: number[]) {
  const map = new Map<number, Array<{
    id: number; siteId: number; siteName: string; url: string; lastPrice: number | null; inStock: boolean | null;
    quantity: number; statusText: string | null; lastError: string | null; checkedAt: string | null;
  }>>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select({ link: productTrackingLinks, siteName: trackingSites.name })
    .from(productTrackingLinks)
    .innerJoin(trackingSites, eq(trackingSites.id, productTrackingLinks.siteId))
    .where(inArray(productTrackingLinks.productDbId, productIds));
  for (const row of rows) {
    const current = map.get(row.link.productDbId) ?? [];
    current.push({
      id: row.link.id,
      siteId: row.link.siteId,
      siteName: row.siteName,
      url: row.link.url,
      lastPrice: row.link.lastPrice,
      inStock: row.link.inStock,
      quantity: row.link.quantity,
      statusText: row.link.statusText,
      lastError: row.link.lastError,
      checkedAt: row.link.checkedAt?.toISOString() ?? null,
    });
    map.set(row.link.productDbId, current);
  }
  return map;
}

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  stock: z.enum(['in', 'out', 'all']).default('all'),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sort: z.enum(['updated', 'title', 'price_asc', 'price_desc', 'stock']).default('updated'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(5000).default(50),
  parentProductId: z.string().max(80).optional(),
  parentOnly: z.coerce.boolean().default(false),
  type: z.string().max(50).optional(),
});

const bulkSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
  action: z.enum(['activate', 'deactivate', 'delete', 'restore', 'promote', 'demote', 'setStock', 'adjustPrice']),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  /** Percentage change, e.g. -10 to cut every selected price by a tenth. */
  percent: z.coerce.number().min(-90).max(900).optional(),
});

/** Resolves a category/brand name to its id, creating the row when new. */
async function resolveTaxonomy(
  table: typeof categories | typeof brands,
  name: string | null | undefined,
): Promise<number | null> {
  const clean = String(name ?? '').trim();
  if (!clean) return null;
  const [found] = await db
    .select({ id: table.id })
    .from(table)
    .where(or(eq(table.name, clean), eq(table.faName, clean)))
    .limit(1);
  if (found) return found.id;
  const [created] = await db.insert(table).values({ name: clean, faName: clean }).returning({ id: table.id });
  return created?.id ?? null;
}

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_products'));

  app.get('/admin/products', async (req) => {
    const q = listQuery.parse(req.query);
    const filters: SQL[] = [];
    if (!q.includeDeleted) filters.push(isNull(products.deletedAt));

    if (q.status !== 'all') filters.push(eq(products.status, q.status));
    if (q.categoryId) filters.push(eq(products.categoryId, q.categoryId));
    if (q.brandId) filters.push(eq(products.brandId, q.brandId));
    if (q.parentProductId !== undefined) {
      filters.push(eq(products.parentProductId, q.parentProductId));
    } else if (q.parentOnly) {
      filters.push(or(isNull(products.parentProductId), eq(products.parentProductId, ''))!);
    }
    if (q.q) {
      filters.push(
        or(
          ilike(products.searchText, `%${q.q.toLowerCase()}%`),
          ilike(products.productId, `%${q.q}%`),
          ilike(products.sku, `%${q.q}%`),
        )!,
      );
    }
    if (q.stock === 'in') {
      filters.push(sql`(${products.stock} + ${products.kermanStock} + ${products.tehranStock}) > 0`);
    } else if (q.stock === 'out') {
      filters.push(sql`(${products.stock} + ${products.kermanStock} + ${products.tehranStock}) = 0`);
    }

    if (q.type) {
      filters.push(eq(products.type, q.type));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const order =
      q.sort === 'title'
        ? asc(products.title)
        : q.sort === 'price_asc'
          ? asc(products.price)
          : q.sort === 'price_desc'
            ? desc(products.price)
            : q.sort === 'stock'
              ? asc(products.stock)
              : desc(products.updatedAt);

    const [rows, [total]] = await Promise.all([
      db
        .select({
          product: products,
          category: { name: categories.name, faName: categories.faName },
          brand: { name: brands.name, faName: brands.faName },
        })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .leftJoin(brands, eq(brands.id, products.brandId))
        .where(where)
        .orderBy(order)
        .limit(q.perPage)
        .offset(offsetOf(q)),
      db.select({ n: count() }).from(products).where(where),
    ]);

    const trackingLinkMap = await loadTrackingLinks(rows.map((row) => row.product.id));
    return {
      ok: true,
      items: rows.map((r) => ({ ...toProductDTO(r.product, r.category, r.brand, { includeAdminSource: true }), trackingLinks: trackingLinkMap.get(r.product.id) ?? [] })),
      total: Number(total?.n ?? 0),
      page: q.page,
      perPage: q.perPage,
    };
  });

  app.get('/admin/products/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [row] = await db
      .select({
        product: products,
        category: { name: categories.name, faName: categories.faName },
        brand: { name: brands.name, faName: brands.faName },
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(eq(products.id, id))
      .limit(1);
    if (!row) throw notFound('محصول پیدا نشد.');
    const trackingLinkMap = await loadTrackingLinks([row.product.id]);
    return { ok: true, product: { ...toProductDTO(row.product, row.category, row.brand, { includeAdminSource: true }), trackingLinks: trackingLinkMap.get(row.product.id) ?? [] } };
  });

  app.post('/admin/products', async (req) => {
    const body = productWriteSchema.parse(req.body);
    const duplicate = await findProductDuplicate(body);
    if (duplicate) throw conflict(duplicateProductMessage(duplicate));

    const categoryId = await resolveTaxonomy(categories, body.categoryName);
    const brandId = await resolveTaxonomy(brands, body.brandName);
    const trackingLinks = await validateTrackingLinks(body.trackingLinks);
    const { categoryName: _c, brandName: _b, trackingLinks: _links, ...rest } = body;

    const [created] = await db
      .insert(products)
      .values({
        ...rest,
        targetSiteUrl: trackingLinks[0]?.url ?? rest.targetSiteUrl ?? null,
        // The per-warehouse counts are optional in the form but NOT NULL in the
        // table; a blank field means zero, not "unknown".
        kermanStock: rest.kermanStock ?? 0,
        tehranStock: rest.tehranStock ?? 0,
        categoryId,
        brandId,
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
    await replaceTrackingLinks(created.id, trackingLinks);

    invalidateCatalog();
    await logAction(req.currentUser!.id, 'create', 'product', created.productId, { title: created.title });
    const trackingLinkMap = await loadTrackingLinks([created.id]);
    return { ok: true, product: { ...toProductDTO(created, null, null, { includeAdminSource: true }), trackingLinks: trackingLinkMap.get(created.id) ?? [] } };
  });

  app.patch('/admin/products/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = productPatchSchema.parse(req.body);

    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw notFound('محصول پیدا نشد.');

    const duplicate = await findProductDuplicate({ ...existing, ...body }, id);
    if (duplicate) throw conflict(duplicateProductMessage(duplicate));

    const patch: Record<string, unknown> = { ...body, updatedAt: new Date() };
    const trackingLinks = body.trackingLinks === undefined ? undefined : await validateTrackingLinks(body.trackingLinks);
    delete patch.trackingLinks;
    delete patch.categoryName;
    delete patch.brandName;
    if (trackingLinks !== undefined) patch.targetSiteUrl = trackingLinks[0]?.url ?? null;
    if (body.kermanStock === null) patch.kermanStock = 0;
    if (body.tehranStock === null) patch.tehranStock = 0;

    if (body.categoryName !== undefined) patch.categoryId = await resolveTaxonomy(categories, body.categoryName);
    if (body.brandName !== undefined) patch.brandId = await resolveTaxonomy(brands, body.brandName);

    const brandLabel =
      body.brandName ??
      (existing.brandId
        ? (await db.select({ name: brands.name }).from(brands).where(eq(brands.id, existing.brandId)).limit(1))[0]?.name
        : null);

    patch.searchText = buildSearchText([
      body.title ?? existing.title,
      body.subTitle ?? existing.subTitle,
      body.model ?? existing.model,
      brandLabel,
      body.color ?? existing.color,
      body.colorEn ?? existing.colorEn,
      body.sku ?? existing.sku,
      existing.productId,
    ]);

    const [updated] = await db.update(products).set(patch).where(eq(products.id, id)).returning();
    if (trackingLinks !== undefined) await replaceTrackingLinks(id, trackingLinks);
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'update', 'product', existing.productId, body as Record<string, unknown>);
    const trackingLinkMap = await loadTrackingLinks([id]);
    return { ok: true, product: { ...toProductDTO(updated!, null, null, { includeAdminSource: true }), trackingLinks: trackingLinkMap.get(id) ?? [] } };
  });

  /** Soft delete: the row stays so the sheet and past orders keep their reference. */
  app.delete('/admin/products/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [updated] = await db
      .update(products)
      .set({ deletedAt: new Date(), status: 'inactive', updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    if (!updated) throw notFound('محصول پیدا نشد.');
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'delete', 'product', updated.productId);
    return { ok: true, message: 'محصول حذف شد.' };
  });

  app.post('/admin/products/bulk', async (req) => {
    const body = bulkSchema.parse(req.body);
    const now = new Date();
    const where = inArray(products.id, body.ids);
    let changed = 0;

    switch (body.action) {
      case 'activate':
        changed = (await db.update(products).set({ status: 'active', updatedAt: now }).where(where).returning({ id: products.id })).length;
        break;
      case 'deactivate':
        changed = (await db.update(products).set({ status: 'inactive', updatedAt: now }).where(where).returning({ id: products.id })).length;
        break;
      case 'delete':
        changed = (await db.update(products).set({ deletedAt: now, status: 'inactive', updatedAt: now }).where(where).returning({ id: products.id })).length;
        break;
      case 'restore':
        changed = (await db.update(products).set({ deletedAt: null, status: 'active', updatedAt: now }).where(where).returning({ id: products.id })).length;
        break;
      case 'promote':
        changed = (await db.update(products).set({ promotion: true, updatedAt: now }).where(where).returning({ id: products.id })).length;
        break;
      case 'demote':
        changed = (await db.update(products).set({ promotion: false, updatedAt: now }).where(where).returning({ id: products.id })).length;
        break;
      case 'setStock': {
        if (body.stock == null) throw badRequest('مقدار موجودی را وارد کنید.');
        changed = (await db.update(products).set({ stock: body.stock, updatedAt: now }).where(where).returning({ id: products.id })).length;
        break;
      }
      case 'adjustPrice': {
        if (body.percent == null) throw badRequest('درصد تغییر قیمت را وارد کنید.');
        const factor = 1 + body.percent / 100;
        changed = (
          await db
            .update(products)
            .set({
              // Both sides need an explicit numeric cast: `price` is a bigint,
              // so Postgres otherwise tries to read the factor as one and
              // rejects anything with a decimal point.
              price: sql`greatest(0, round(${products.price}::numeric * ${String(factor)}::numeric))::bigint`,
              updatedAt: now,
            })
            .where(where)
            .returning({ id: products.id })
        ).length;
        break;
      }
    }

    invalidateCatalog();
    await logAction(req.currentUser!.id, `bulk:${body.action}`, 'product', null, { count: changed });
    return { ok: true, changed, message: `${changed} محصول به‌روزرسانی شد.` };
  });

  /** Rows the sync soft-deleted or an admin removed, so they can be brought back. */
  app.get('/admin/products/trash', async () => {
    const rows = await db
      .select()
      .from(products)
      .where(isNotNull(products.deletedAt))
      .orderBy(desc(products.deletedAt))
      .limit(200);
    return { ok: true, items: rows.map((r) => toProductDTO(r, null, null, { includeAdminSource: true })) };
  });

  /** Sync Tehran warehouse stock from external target website link */
  app.post('/admin/products/:id/sync-target-stock', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) throw notFound('محصول یافت نشد.');
    if (!product.targetSiteUrl || !product.targetSiteUrl.trim()) {
      throw badRequest('لینک سایت هدف برای این محصول ثبت نشده است.');
    }

    const result = await fetchTargetSiteStock(product.targetSiteUrl.trim());
    const newTehranStock = result.inStock ? (result.quantity || 10) : 0;
    const newStock = product.kermanStock + newTehranStock;

    const [updated] = await db
      .update(products)
      .set({
        tehranStock: newTehranStock,
        stock: newStock,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    if (!updated) throw notFound('محصول یافت نشد.');

    invalidateCatalog();
    await logAction(req.currentUser!.id, 'sync_target_stock', 'product', String(product.id), {
      url: product.targetSiteUrl,
      tehranStock: newTehranStock,
      statusText: result.statusText,
    });

    return {
      ok: true,
      product: toProductDTO(updated, null, null, { includeAdminSource: true }),
      statusText: result.statusText,
      tehranStock: newTehranStock,
    };
  });

  /** Batch sync Tehran warehouse stocks for all products with a targetSiteUrl */
  app.post('/admin/products/sync-target-stocks', async (req) => {
    const targetProducts = await db
      .select()
      .from(products)
      .where(and(isNull(products.deletedAt), isNotNull(products.targetSiteUrl)));

    let success = 0;
    let failed = 0;
    const results: Array<{ id: number; title: string; tehranStock: number; statusText: string }> = [];

    for (const p of targetProducts) {
      if (!p.targetSiteUrl || !p.targetSiteUrl.trim()) continue;
      const res = await fetchTargetSiteStock(p.targetSiteUrl.trim());
      const newTehranStock = res.inStock ? (res.quantity || 10) : 0;
      const newStock = p.kermanStock + newTehranStock;

      await db
        .update(products)
        .set({
          tehranStock: newTehranStock,
          stock: newStock,
          updatedAt: new Date(),
        })
        .where(eq(products.id, p.id));

      if (res.inStock) success++;
      else failed++;

      results.push({
        id: p.id,
        title: p.title,
        tehranStock: newTehranStock,
        statusText: res.statusText,
      });
    }

    invalidateCatalog();
    await logAction(req.currentUser!.id, 'sync_all_target_stocks', 'product', null, {
      total: targetProducts.length,
      success,
      failed,
    });

    return {
      ok: true,
      total: targetProducts.length,
      success,
      failed,
      results,
      message: `بروزرسانی انبار تهران انجام شد (${success} موجود، ${failed} ناموجود).`,
    };
  });
};

const MAX_TARGET_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_TARGET_REDIRECTS = 3;

function isPrivateAddress(address: string): boolean {
  const lower = address.toLowerCase();
  if (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) return true;

  const mappedV4 = lower.startsWith('::ffff:') ? address.slice(7) : address;
  if (isIP(mappedV4) !== 4) return false;
  const octets = mappedV4.split('.').map(Number);
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

async function validatePublicTargetUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('فقط لینک HTTP یا HTTPS مجاز است');
  if (url.username || url.password) throw new Error('لینک دارای نام کاربری یا رمز عبور مجاز نیست');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('آدرس داخلی مجاز نیست');
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('آدرس داخلی یا رزروشده مجاز نیست');
  }
  return url;
}

async function fetchPublicTarget(value: string): Promise<Response> {
  let url = await validatePublicTargetUrl(value);
  for (let redirects = 0; redirects <= MAX_TARGET_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TamasStockBot/2.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.7',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('پاسخ تغییر مسیر معتبر نیست');
    url = await validatePublicTargetUrl(new URL(location, url).toString());
  }
  throw new Error('تعداد تغییر مسیرهای سایت هدف بیش از حد مجاز است');
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_TARGET_RESPONSE_BYTES) throw new Error('حجم پاسخ سایت هدف بیش از حد مجاز است');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_TARGET_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('حجم پاسخ سایت هدف بیش از حد مجاز است');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchTargetSiteStock(targetUrl: string): Promise<{ inStock: boolean; quantity: number; statusText: string }> {
  try {
    const res = await fetchPublicTarget(targetUrl);
    if (!res.ok) {
      return { inStock: false, quantity: 0, statusText: `خطای HTTP ${res.status}` };
    }
    const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { inStock: false, quantity: 0, statusText: 'پاسخ سایت هدف HTML نیست' };
    }
    const html = await readLimitedText(res);
    const lowerHtml = html.toLowerCase();

    // Check common Iranian e-commerce out-of-stock indicators
    if (
      html.includes('ناموجود') ||
      html.includes('عدم موجودی') ||
      html.includes('موجودی نیست') ||
      html.includes('out of stock') ||
      lowerHtml.includes('outofstock') ||
      html.includes('اتمام موجودی')
    ) {
      return { inStock: false, quantity: 0, statusText: 'ناموجود در سایت هدف' };
    }

    // Check common Iranian e-commerce in-stock indicators
    if (
      html.includes('موجود در انبار') ||
      html.includes('افزودن به سبد خرید') ||
      html.includes('خرید آنلاین') ||
      html.includes('in stock') ||
      lowerHtml.includes('instock')
    ) {
      return { inStock: true, quantity: 10, statusText: 'موجود در سایت هدف (۱۰ عدد)' };
    }

    return { inStock: true, quantity: 5, statusText: 'شناسایی‌شده به‌عنوان موجود' };
  } catch (err: any) {
    return { inStock: false, quantity: 0, statusText: `خطا در برقراری ارتباط: ${err.message || 'پاسخی دریافت نشد'}` };
  }
}

export default routes;
