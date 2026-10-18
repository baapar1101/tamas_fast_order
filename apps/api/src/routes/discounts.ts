import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { discountCodes, products } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { ensureCustomerDiscount, validateCustomerDiscount } from '../services/discounts.js';

const quoteSchema = z.object({
  code: z.string().trim().min(1).max(40),
  items: z.array(z.object({ productId: z.string().trim().min(1).max(80), qty: z.coerce.number().int().min(1).max(10_000) })).min(1).max(200),
});

const routes: FastifyPluginAsync = async (app) => {
  app.get('/discounts/my', { preHandler: app.requireUser }, async (req) => {
    await ensureCustomerDiscount(req.currentUser!.id);
    const items = await db.select().from(discountCodes)
      .where(and(eq(discountCodes.userId, req.currentUser!.id), eq(discountCodes.isActive, true)))
      .orderBy(desc(discountCodes.createdAt));
    return { ok: true, items: items.map((item) => ({
      code: item.code, kind: item.kind, value: item.value, firstOrderOnly: item.firstOrderOnly,
      minOrderAmount: item.minOrderAmount, maxDiscountAmount: item.maxDiscountAmount,
      startsAt: item.startsAt?.toISOString() ?? null, endsAt: item.endsAt?.toISOString() ?? null,
      remainingUses: Math.max(0, item.usageLimit - item.usedCount),
    })) };
  });

  app.post('/discounts/quote', { preHandler: app.requireUser }, async (req) => {
    const body = quoteSchema.parse(req.body);
    const ids = [...new Set(body.items.map((item) => item.productId))];
    const rows = await db.select({ productId: products.productId, price: products.price }).from(products)
      .where(and(inArray(products.productId, ids), isNull(products.deletedAt), eq(products.status, 'active')));
    const byId = new Map(rows.map((row) => [row.productId, row.price]));
    let subtotal = 0;
    for (const item of body.items) {
      const price = byId.get(item.productId);
      if (price == null) throw badRequest('یکی از کالاهای سبد دیگر قابل سفارش نیست.');
      subtotal += price * item.qty;
    }
    const discount = await db.transaction((tx) => validateCustomerDiscount(tx, req.currentUser!.id, body.code, subtotal));
    return { ok: true, ...discount, subtotal, total: Math.max(0, subtotal - discount.amount) };
  });
};

export default routes;
