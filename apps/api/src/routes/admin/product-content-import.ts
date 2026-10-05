import { and, asc, isNotNull, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { products } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';
import { importProductContent } from '../../services/product-content-import.js';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const batchSchema = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(100) });

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_products'));

  app.get('/admin/product-content-import/products', async () => {
    const rows = await db
      .select({
        id: products.id,
        productId: products.productId,
        title: products.title,
        imageUrl: products.imageUrl,
        gallery: products.gallery,
        attributeCount: sql<number>`jsonb_array_length(${products.attributes})::int`,
        rating: products.rating,
        ratingCount: products.ratingCount,
        externalDataUpdatedAt: products.externalDataUpdatedAt,
      })
      .from(products)
      .where(and(isNull(products.deletedAt), isNotNull(products.digikalaLink), sql`trim(${products.digikalaLink}) <> ''`))
      .orderBy(asc(products.title));

    return {
      ok: true,
      items: rows.map((row) => ({
        ...row,
        imageCount: (row.imageUrl ? 1 : 0) + (row.gallery?.length ?? 0),
        externalDataUpdatedAt: row.externalDataUpdatedAt?.toISOString() ?? null,
      })),
    };
  });

  app.post('/admin/product-content-import/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const result = await importProductContent(id, req.currentUser!.id);
    await logAction(req.currentUser!.id, 'update', 'product_content', result.productId, {
      imageCount: result.imageCount,
      attributeCount: result.attributeCount,
      rating: result.rating,
    });
    return { ok: true, result, message: 'اطلاعات محصول دریافت و ذخیره شد.' };
  });

  app.post('/admin/product-content-import', async (req) => {
    const { ids } = batchSchema.parse(req.body);
    const existing = await db.select({ id: products.id }).from(products).where(and(isNull(products.deletedAt), isNotNull(products.digikalaLink), sql`trim(${products.digikalaLink}) <> ''`));
    const allowed = new Set(existing.map((row) => row.id));
    const targetIds = [...new Set(ids)].filter((id) => allowed.has(id));
    if (targetIds.length === 0) throw notFound('محصول واجد شرایطی پیدا نشد.');

    const results: Awaited<ReturnType<typeof importProductContent>>[] = [];
    const errors: Array<{ id: number; error: string }> = [];
    for (const id of targetIds) {
      try {
        results.push(await importProductContent(id, req.currentUser!.id));
      } catch (error) {
        errors.push({ id, error: error instanceof Error ? error.message : 'خطای نامشخص' });
      }
    }
    await logAction(req.currentUser!.id, 'update', 'product_content_batch', String(targetIds.length), {
      succeeded: results.length,
      failed: errors.length,
    });
    return { ok: errors.length === 0, results, errors, message: `${results.length} محصول به‌روزرسانی شد.` };
  });
};

export default routes;
