import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { brandWriteSchema, categoryWriteSchema, colorWriteSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { brands, categories, categoryBrands, colors, products } from '../../db/schema.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { invalidateCatalog, listBrands, listCategories, listColors } from '../../services/catalog.js';
import { logAction } from '../../services/audit.js';
import { enqueueCrmProductSync } from '../../services/crm-product-sync.js';
import { findTaxonomyId } from '../../services/product-create.js';

/** Rebuilds a category's brand links from the names the panel sent. */
async function syncCategoryBrands(categoryId: number, brandNames: string[]): Promise<void> {
  const names = [...new Set(brandNames.map((name) => name.trim()).filter(Boolean))];

  await db.transaction(async (tx) => {
    if (names.length > 0) {
      const existing = await tx.select({ name: brands.name }).from(brands).where(inArray(brands.name, names));
      const existingNames = new Set(existing.map((brand) => brand.name));
      const missingNames = names.filter((name) => !existingNames.has(name));

      if (missingNames.length > 0) {
        await tx
          .insert(brands)
          .values(missingNames.map((name) => ({ name, faName: name })))
          .onConflictDoNothing();
      }
    }

    const linkedBrands = names.length > 0
      ? await tx.select({ id: brands.id }).from(brands).where(inArray(brands.name, names))
      : [];

    await tx.delete(categoryBrands).where(eq(categoryBrands.categoryId, categoryId));
    if (linkedBrands.length > 0) {
      await tx
        .insert(categoryBrands)
        .values(linkedBrands.map(({ id: brandId }) => ({ categoryId, brandId })))
        .onConflictDoNothing();
    }
  });
}

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_content'));

  /* ---------------- categories ---------------- */

  app.get('/admin/categories', async () => ({ ok: true, categories: await listCategories() }));

  app.post('/admin/categories', async (req) => {
    const body = categoryWriteSchema.parse(req.body);
    const [clash] = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, body.name)).limit(1);
    if (clash) throw conflict('دسته‌بندی با این نام از قبل وجود دارد.');

    const [created] = await db
      .insert(categories)
      .values({ name: body.name, faName: body.faName, iconUrl: body.iconUrl ?? null, sortOrder: body.sortOrder })
      .returning();
    if (!created) throw conflict('ثبت دسته‌بندی ناموفق بود.');

    await syncCategoryBrands(created.id, body.brandNames);
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'create', 'category', created.name);
    return { ok: true, category: created };
  });

  app.patch('/admin/categories/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = categoryWriteSchema.partial().parse(req.body);

    const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!existing) throw notFound('دسته‌بندی پیدا نشد.');

    const [updated] = await db
      .update(categories)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.faName !== undefined ? { faName: body.faName } : {}),
        ...(body.iconUrl !== undefined ? { iconUrl: body.iconUrl } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    if (body.brandNames) await syncCategoryBrands(id, body.brandNames);
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'update', 'category', updated?.name ?? String(id));
    return { ok: true, category: updated };
  });

  app.delete('/admin/categories/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [updated] = await db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    if (!updated) throw notFound('دسته‌بندی پیدا نشد.');
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'delete', 'category', updated.name);
    return { ok: true, message: 'دسته‌بندی حذف شد.' };
  });

  app.post('/admin/categories/reorder', async (req) => {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) return { ok: true };

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id !== undefined) {
        await db
          .update(categories)
          .set({ sortOrder: i + 1, updatedAt: new Date() })
          .where(eq(categories.id, id));
      }
    }
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'update', 'category', 'reorder');
    return { ok: true };
  });

  /* ---------------- brands ---------------- */

  app.get('/admin/brands', async () => ({ ok: true, brands: await listBrands() }));

  app.post('/admin/brands', async (req) => {
    const body = brandWriteSchema.parse(req.body);
    const clashId = await findTaxonomyId(brands, body.name);
    const [clash] = clashId
      ? await db.select({ id: brands.id, deletedAt: brands.deletedAt, faName: brands.faName }).from(brands).where(eq(brands.id, clashId)).limit(1)
      : [];
    if (clash && clash.deletedAt === null) throw conflict(`برند «${clash.faName}» با همین نام از قبل وجود دارد.`);
    if (clash) {
      // The name belongs to a deleted brand: bring it back instead of failing on the unique name.
      const [revived] = await db
        .update(brands)
        .set({ name: body.name, faName: body.faName, iconUrl: body.iconUrl ?? null, sortOrder: body.sortOrder, deletedAt: null, updatedAt: new Date() })
        .where(eq(brands.id, clash.id))
        .returning();
      invalidateCatalog();
      await logAction(req.currentUser!.id, 'create', 'brand', body.name);
      return { ok: true, brand: revived };
    }

    const [created] = await db
      .insert(brands)
      .values({ name: body.name, faName: body.faName, iconUrl: body.iconUrl ?? null, sortOrder: body.sortOrder })
      .returning();
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'create', 'brand', body.name);
    return { ok: true, brand: created };
  });

  app.patch('/admin/brands/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = brandWriteSchema.partial().parse(req.body);
    const [updated] = await db
      .update(brands)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.faName !== undefined ? { faName: body.faName } : {}),
        ...(body.iconUrl !== undefined ? { iconUrl: body.iconUrl } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(eq(brands.id, id))
      .returning();
    if (!updated) throw notFound('برند پیدا نشد.');
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'update', 'brand', updated.name);
    return { ok: true, brand: updated };
  });

  /**
   * Moves every product and category link of a duplicate brand onto the brand
   * to keep, then deletes the duplicate.
   */
  app.post('/admin/brands/:id/merge', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const { intoId } = z.object({ intoId: z.number().int().positive() }).parse(req.body);
    if (id === intoId) throw badRequest('برند مقصد باید با برند ادغام‌شونده فرق کند.');
    const rows = await db.select().from(brands).where(and(inArray(brands.id, [id, intoId]), isNull(brands.deletedAt)));
    const source = rows.find((row) => row.id === id);
    const target = rows.find((row) => row.id === intoId);
    if (!source || !target) throw notFound('برند پیدا نشد.');

    const moved = await db.transaction(async (tx) => {
      const changed = await tx.update(products).set({ brandId: intoId, updatedAt: new Date() })
        .where(eq(products.brandId, id)).returning({ productId: products.productId });
      const links = await tx.select({ categoryId: categoryBrands.categoryId }).from(categoryBrands).where(eq(categoryBrands.brandId, id));
      if (links.length) {
        await tx.insert(categoryBrands).values(links.map(({ categoryId }) => ({ categoryId, brandId: intoId }))).onConflictDoNothing();
      }
      await tx.delete(categoryBrands).where(eq(categoryBrands.brandId, id));
      await tx.update(brands).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(brands.id, id));
      return changed;
    });
    for (const { productId } of moved) {
      await enqueueCrmProductSync(productId, 'update', { source: 'brand-merge' }).catch(() => undefined);
    }
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'update', 'brand', `merge ${source.name} → ${target.name}`, { products: moved.length });
    return { ok: true, moved: moved.length, message: `${moved.length} محصول از «${source.faName}» به «${target.faName}» منتقل شد.` };
  });

  app.delete('/admin/brands/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [used] = await db.select({ count: sql<number>`count(*)::int` }).from(products)
      .where(and(eq(products.brandId, id), isNull(products.deletedAt)));
    if ((used?.count ?? 0) > 0) {
      throw badRequest(`${used!.count} محصول این برند را دارند. اول با «ادغام» آن‌ها را به برند درست منتقل کنید.`);
    }
    const [updated] = await db
      .update(brands)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(brands.id, id))
      .returning();
    if (!updated) throw notFound('برند پیدا نشد.');
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'delete', 'brand', updated.name);
    return { ok: true, message: 'برند حذف شد.' };
  });

  app.post('/admin/brands/reorder', async (req) => {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) return { ok: true };

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id !== undefined) {
        await db
          .update(brands)
          .set({ sortOrder: i + 1, updatedAt: new Date() })
          .where(eq(brands.id, id));
      }
    }
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'update', 'brand', 'reorder');
    return { ok: true };
  });

  /* ---------------- colors ---------------- */

  app.get('/admin/colors', async () => ({ ok: true, colors: await listColors() }));

  app.post('/admin/colors', async (req) => {
    const body = colorWriteSchema.parse(req.body);
    const [created] = await db
      .insert(colors)
      .values({ code: body.code, name: body.name ?? null, faName: body.faName ?? null })
      .onConflictDoUpdate({
        target: colors.code,
        set: { name: body.name ?? null, faName: body.faName ?? null, updatedAt: new Date(), deletedAt: null },
      })
      .returning();
    invalidateCatalog();
    return { ok: true, color: created };
  });

  app.patch('/admin/colors/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = colorWriteSchema.partial().parse(req.body);
    const [updated] = await db
      .update(colors)
      .set({
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.faName !== undefined ? { faName: body.faName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(colors.id, id))
      .returning();
    if (!updated) throw notFound('رنگ پیدا نشد.');
    invalidateCatalog();
    return { ok: true, color: updated };
  });

  app.delete('/admin/colors/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    await db.delete(colors).where(eq(colors.id, id));
    invalidateCatalog();
    return { ok: true, message: 'رنگ حذف شد.' };
  });

  /** Flat lists for the pickers in the product editor. */
  app.get('/admin/taxonomy', async () => {
    const [cats, brs] = await Promise.all([
      db.select().from(categories).where(isNull(categories.deletedAt)).orderBy(asc(categories.faName)),
      db.select().from(brands).where(isNull(brands.deletedAt)).orderBy(asc(brands.faName)),
    ]);
    return { ok: true, categories: cats, brands: brs };
  });
};

export default routes;
