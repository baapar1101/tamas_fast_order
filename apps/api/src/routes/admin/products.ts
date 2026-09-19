import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { productPatchSchema, productWriteSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { brands, categories, products } from '../../db/schema.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import { buildSearchText, invalidateCatalog, toProductDTO } from '../../services/catalog.js';
import { logAction } from '../../services/audit.js';

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  stock: z.enum(['in', 'out', 'all']).default('all'),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sort: z.enum(['updated', 'title', 'price_asc', 'price_desc', 'stock']).default('updated'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
  parentProductId: z.string().max(80).optional(),
  parentOnly: z.coerce.boolean().default(false),
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
  app.addHook('preHandler', app.requireAdmin);

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

    return {
      ok: true,
      items: rows.map((r) => toProductDTO(r.product, r.category, r.brand)),
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
    return { ok: true, product: toProductDTO(row.product, row.category, row.brand) };
  });

  app.post('/admin/products', async (req) => {
    const body = productWriteSchema.parse(req.body);

    const [clash] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.productId, body.productId))
      .limit(1);
    if (clash) throw conflict('محصولی با این شناسه از قبل وجود دارد.');

    const categoryId = await resolveTaxonomy(categories, body.categoryName);
    const brandId = await resolveTaxonomy(brands, body.brandName);
    const { categoryName: _c, brandName: _b, ...rest } = body;

    const [created] = await db
      .insert(products)
      .values({
        ...rest,
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

    invalidateCatalog();
    await logAction(req.currentUser!.id, 'create', 'product', created.productId, { title: created.title });
    return { ok: true, product: toProductDTO(created) };
  });

  app.patch('/admin/products/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = productPatchSchema.parse(req.body);

    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw notFound('محصول پیدا نشد.');

    const patch: Record<string, unknown> = { ...body, updatedAt: new Date() };
    delete patch.categoryName;
    delete patch.brandName;
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
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'update', 'product', existing.productId, body as Record<string, unknown>);
    return { ok: true, product: toProductDTO(updated!) };
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
    return { ok: true, items: rows.map((r) => toProductDTO(r)) };
  });
};

export default routes;
