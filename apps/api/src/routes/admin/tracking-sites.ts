import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { idSchema, trackingSiteWriteSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { productTrackingLinks, products, trackingSites } from '../../db/schema.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';
import { invalidateCatalog } from '../../services/catalog.js';
import { fetchTargetSiteSnapshot } from '../../services/target-tracking.js';

async function syncProduct(productDbId: number) {
  const [product] = await db.select().from(products).where(and(eq(products.id, productDbId), isNull(products.deletedAt))).limit(1);
  if (!product) throw notFound('محصول پیدا نشد.');

  const links = await db
    .select({ link: productTrackingLinks, site: trackingSites })
    .from(productTrackingLinks)
    .innerJoin(trackingSites, eq(trackingSites.id, productTrackingLinks.siteId))
    .where(and(eq(productTrackingLinks.productDbId, productDbId), eq(trackingSites.isActive, true)))
    .orderBy(asc(trackingSites.name));
  if (links.length === 0) throw badRequest('برای این محصول لینک رهگیری فعالی ثبت نشده است.');

  const now = new Date();
  const results = [];
  for (const row of links) {
    const snapshot = await fetchTargetSiteSnapshot(row.link.url);
    const price = snapshot.price == null ? null : row.site.priceUnit === 'rial' ? Math.round(snapshot.price / 10) : snapshot.price;
    await db.update(productTrackingLinks).set({
      lastPrice: price,
      inStock: snapshot.inStock,
      quantity: snapshot.quantity,
      statusText: snapshot.statusText,
      lastError: snapshot.error,
      checkedAt: now,
      updatedAt: now,
    }).where(eq(productTrackingLinks.id, row.link.id));
    results.push({
      siteId: row.site.id,
      siteName: row.site.name,
      inStock: snapshot.inStock,
      quantity: snapshot.quantity,
      price,
      statusText: snapshot.statusText,
      error: snapshot.error,
    });
  }

  const successful = results.filter((result) => !result.error);
  let tehranStock = product.tehranStock;
  if (successful.length > 0) {
    tehranStock = Math.max(0, ...successful.filter((result) => result.inStock).map((result) => result.quantity));
    await db.update(products).set({
      tehranStock,
      stock: product.kermanStock + tehranStock,
      updatedAt: now,
    }).where(eq(products.id, productDbId));
    invalidateCatalog();
  }

  return { productId: product.productId, title: product.title, tehranStock, results };
}

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_products'));

  app.get('/admin/tracking-sites', async () => {
    const rows = await db
      .select({ site: trackingSites, linkCount: count(productTrackingLinks.id) })
      .from(trackingSites)
      .leftJoin(productTrackingLinks, eq(productTrackingLinks.siteId, trackingSites.id))
      .groupBy(trackingSites.id)
      .orderBy(asc(trackingSites.name));
    return {
      ok: true,
      items: rows.map(({ site, linkCount }) => ({
        ...site,
        linkCount: Number(linkCount),
        createdAt: site.createdAt.toISOString(),
        updatedAt: site.updatedAt.toISOString(),
      })),
    };
  });

  app.post('/admin/tracking-sites', async (req) => {
    const body = trackingSiteWriteSchema.parse(req.body);
    const [existing] = await db.select({ id: trackingSites.id }).from(trackingSites).where(eq(trackingSites.name, body.name)).limit(1);
    if (existing) throw conflict('سایتی با این نام قبلاً ثبت شده است.');
    const [created] = await db.insert(trackingSites).values(body).returning();
    if (!created) throw badRequest('ثبت سایت ناموفق بود.');
    await logAction(req.currentUser!.id, 'create', 'tracking_site', String(created.id), { name: created.name });
    return { ok: true, site: created, message: 'سایت رهگیری اضافه شد.' };
  });

  app.patch('/admin/tracking-sites/:id', async (req) => {
    const id = idSchema.parse((req.params as { id: string }).id);
    const body = trackingSiteWriteSchema.partial().parse(req.body);
    const [updated] = await db.update(trackingSites).set({ ...body, updatedAt: new Date() }).where(eq(trackingSites.id, id)).returning();
    if (!updated) throw notFound('سایت پیدا نشد.');
    await logAction(req.currentUser!.id, 'update', 'tracking_site', String(id), body);
    return { ok: true, site: updated, message: 'تنظیمات سایت ذخیره شد.' };
  });

  app.delete('/admin/tracking-sites/:id', async (req) => {
    const id = idSchema.parse((req.params as { id: string }).id);
    const [site] = await db.delete(trackingSites).where(eq(trackingSites.id, id)).returning();
    if (!site) throw notFound('سایت پیدا نشد.');
    await logAction(req.currentUser!.id, 'delete', 'tracking_site', String(id), { name: site.name });
    return { ok: true, message: 'سایت و لینک‌های وابسته حذف شدند.' };
  });

  app.post('/admin/tracking/products/:id/sync', async (req) => {
    const id = idSchema.parse((req.params as { id: string }).id);
    const result = await syncProduct(id);
    await logAction(req.currentUser!.id, 'sync', 'product_tracking', result.productId, { sites: result.results.length });
    return { ok: true, result, message: 'قیمت و موجودی سایت‌های محصول بررسی شد.' };
  });

  app.post('/admin/tracking/sync', async (req) => {
    const productRows = await db
      .selectDistinct({ id: productTrackingLinks.productDbId })
      .from(productTrackingLinks)
      .innerJoin(products, eq(products.id, productTrackingLinks.productDbId))
      .innerJoin(trackingSites, eq(trackingSites.id, productTrackingLinks.siteId))
      .where(and(isNull(products.deletedAt), eq(trackingSites.isActive, true)));
    const results = [];
    const errors: Array<{ id: number; error: string }> = [];
    for (const row of productRows) {
      try {
        results.push(await syncProduct(row.id));
      } catch (error) {
        errors.push({ id: row.id, error: error instanceof Error ? error.message : 'خطای نامشخص' });
      }
    }
    await logAction(req.currentUser!.id, 'sync_all', 'product_tracking', null, { total: productRows.length, failed: errors.length });
    return { ok: errors.length === 0, results, errors, message: `${results.length} محصول بررسی شد.` };
  });
};

export default routes;
