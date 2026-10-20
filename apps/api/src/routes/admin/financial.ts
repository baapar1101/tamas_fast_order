import type { FastifyPluginAsync } from 'fastify';
import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { payments, products } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import { logAction } from '../../services/audit.js';

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

const financialRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/financial/payments/count', async () => {
    const [result] = await db.select({ total: count() }).from(payments);
    return { ok: true, count: result?.total ?? 0 };
  });

  app.get('/admin/financial/payments', async (req) => {
    const query = pageQuery.parse(req.query);
    const [items, [total]] = await Promise.all([
      db.select().from(payments).orderBy(desc(payments.createdAt)).limit(query.perPage).offset(offsetOf(query)),
      db.select({ n: count() }).from(payments),
    ]);
    return {
      ok: true,
      items: items.map((payment) => ({ ...payment, createdAt: payment.createdAt.toISOString(), updatedAt: payment.updatedAt.toISOString() })),
      total: Number(total?.n ?? 0),
      page: query.page,
      perPage: query.perPage,
    };
  });

  app.get('/admin/financial/inventory-costs', async (req) => {
    const query = pageQuery.extend({ q: z.string().trim().max(200).optional() }).parse(req.query);
    const filters = [isNull(products.deletedAt)];
    if (query.q) filters.push(or(ilike(products.title, `%${query.q}%`), ilike(products.productId, `%${query.q}%`), ilike(products.sku, `%${query.q}%`))!);
    const where = and(...filters);
    const [rows, [total]] = await Promise.all([
      db.select({
        id: products.id,
        productId: products.productId,
        sku: products.sku,
        title: products.title,
        stock: products.stock,
        kermanStock: products.kermanStock,
        tehranStock: products.tehranStock,
        costPrice: products.costPrice,
        salePrice: products.price,
      }).from(products).where(where).orderBy(desc(products.updatedAt)).limit(query.perPage).offset(offsetOf(query)),
      db.select({ n: count() }).from(products).where(where),
    ]);
    return {
      ok: true,
      items: rows.map((row) => {
        const split = Math.max(0, row.kermanStock) + Math.max(0, row.tehranStock);
        const stock = split > 0 ? split : Math.max(0, row.stock);
        return { id: row.id, productId: row.productId, sku: row.sku, title: row.title, stock, costPrice: row.costPrice, salePrice: row.salePrice, inventoryValue: stock * row.costPrice };
      }),
      total: Number(total?.n ?? 0),
      page: query.page,
      perPage: query.perPage,
    };
  });

  app.patch('/admin/financial/inventory-costs/:id', async (req) => {
    const id = z.coerce.number().int().positive().parse((req.params as { id: string }).id);
    const { costPrice } = z.object({ costPrice: z.coerce.number().int().min(0) }).parse(req.body);
    const [updated] = await db.update(products).set({ costPrice, updatedAt: new Date() })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning({ id: products.id, productId: products.productId });
    if (!updated) throw notFound('کالا پیدا نشد.');
    await logAction(req.currentUser!.id, 'update_cost_price', 'product', updated.productId, { costPrice });
    return { ok: true, product: { ...updated, costPrice } };
  });
};

export default financialRoutes;
