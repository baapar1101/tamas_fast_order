import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { payments } from '../../db/schema.js';
import { count, desc } from 'drizzle-orm';

const financialRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  // GET /admin/financial/payments/count
  app.get('/admin/financial/payments/count', async () => {
    const [result] = await db.select({ total: count() }).from(payments);
    return { ok: true, count: result?.total ?? 0 };
  });

  // GET /admin/financial/payments
  app.get('/admin/financial/payments', async () => {
    const allPayments = await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(50);
    
    return {
      ok: true,
      items: allPayments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        userId: p.userId,
        amount: p.amount,
        gateway: p.gateway,
        refId: p.refId,
        trackingCode: p.trackingCode,
        status: p.status,
        cardPan: p.cardPan,
        note: p.note,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total: allPayments.length,
      page: 1,
      perPage: 50,
    };
  });
};

export default financialRoutes;
