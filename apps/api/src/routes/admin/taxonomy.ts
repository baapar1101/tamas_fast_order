import { asc, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { brandWriteSchema, categoryWriteSchema, colorWriteSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { brands, categories, categoryBrands, colors } from '../../db/schema.js';
import { conflict, notFound } from '../../lib/errors.js';
import { invalidateCatalog, listBrands, listCategories, listColors } from '../../services/catalog.js';
import { logAction } from '../../services/audit.js';

/** Rebuilds a category's brand links from the names the panel sent. */
async function syncCategoryBrands(categoryId: number, brandNames: string[]): Promise<void> {
  await db.delete(categoryBrands).where(eq(categoryBrands.categoryId, categoryId));
  if (brandNames.length === 0) return;

  const ids: number[] = [];
  for (const raw of brandNames) {
    const name = raw.trim();
    if (!name) continue;
    const [found] = await db.select({ id: brands.id }).from(brands).where(eq(brands.name, name)).limit(1);
    if (found) {
      ids.push(found.id);
      continue;
    }
    const [created] = await db.insert(brands).values({ name, faName: name }).returning({ id: brands.id });
    if (created) ids.push(created.id);
  }
  if (ids.length > 0) {
    await db
      .insert(categoryBrands)
      .values(ids.map((brandId) => ({ categoryId, brandId })))
      .onConflictDoNothing();
  }
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
    const [clash] = await db.select({ id: brands.id }).from(brands).where(eq(brands.name, body.name)).limit(1);
    if (clash) throw conflict('برندی با این نام از قبل وجود دارد.');

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

  app.delete('/admin/brands/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
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
