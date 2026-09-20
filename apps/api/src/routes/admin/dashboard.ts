import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { DashboardStats } from '@tamas/shared';
import { db } from '../../db/client.js';
import { orderItems, orders, products, syncState, users } from '../../db/schema.js';
import { deleteSetting, getAllSettings, setSetting } from '../../services/settings.js';
import { recentAudit } from '../../services/audit.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/stats', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const liveProducts = isNull(products.deletedAt);

    const [
      [productRow],
      [activeRow],
      [outOfStockRow],
      [userRow],
      [pendingUserRow],
      [orderRow],
      [newOrderRow],
      [revenueRow],
      [revenue30Row],
      perDay,
      top,
      syncRows,
    ] = await Promise.all([
      db.select({ n: count() }).from(products).where(liveProducts),
      db.select({ n: count() }).from(products).where(and(liveProducts, eq(products.status, 'active'))),
      db
        .select({ n: count() })
        .from(products)
        .where(and(liveProducts, sql`(${products.stock} + ${products.kermanStock} + ${products.tehranStock}) = 0`)),
      db.select({ n: count() }).from(users).where(isNull(users.deletedAt)),
      db.select({ n: count() }).from(users).where(and(isNull(users.deletedAt), eq(users.isActive, false))),
      db.select({ n: count() }).from(orders).where(isNull(orders.deletedAt)),
      db.select({ n: count() }).from(orders).where(and(isNull(orders.deletedAt), eq(orders.status, 'new'))),
      db
        .select({ total: sql<string>`coalesce(sum(${orders.total}), 0)` })
        .from(orders)
        .where(and(isNull(orders.deletedAt), sql`${orders.status} <> 'cancelled'`)),
      db
        .select({ total: sql<string>`coalesce(sum(${orders.total}), 0)` })
        .from(orders)
        .where(
          and(
            isNull(orders.deletedAt),
            sql`${orders.status} <> 'cancelled'`,
            gte(orders.createdAt, thirtyDaysAgo),
          ),
        ),
      db
        .select({
          day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
          n: count(),
          total: sql<string>`coalesce(sum(${orders.total}), 0)`,
        })
        .from(orders)
        .where(and(isNull(orders.deletedAt), gte(orders.createdAt, thirtyDaysAgo)))
        .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`),
      db
        .select({
          title: orderItems.title,
          qty: sql<string>`sum(${orderItems.qty})`,
          total: sql<string>`sum(${orderItems.qty} * ${orderItems.price})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(isNull(orders.deletedAt), gte(orders.createdAt, thirtyDaysAgo)))
        .groupBy(orderItems.title)
        .orderBy(sql`sum(${orderItems.qty}) desc`)
        .limit(10),
      db.select().from(syncState),
    ]);

    const lastSync = syncRows
      .flatMap((s) => [s.lastPulledAt, s.lastPushedAt])
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const stats: DashboardStats = {
      productCount: Number(productRow?.n ?? 0),
      activeProductCount: Number(activeRow?.n ?? 0),
      outOfStockCount: Number(outOfStockRow?.n ?? 0),
      userCount: Number(userRow?.n ?? 0),
      pendingUserCount: Number(pendingUserRow?.n ?? 0),
      orderCount: Number(orderRow?.n ?? 0),
      newOrderCount: Number(newOrderRow?.n ?? 0),
      revenueTotal: Number(revenueRow?.total ?? 0),
      revenueLast30Days: Number(revenue30Row?.total ?? 0),
      ordersPerDay: perDay.map((r) => ({ day: r.day, count: Number(r.n), total: Number(r.total) })),
      topProducts: top.map((r) => ({ title: r.title, qty: Number(r.qty), total: Number(r.total) })),
      lastSyncAt: lastSync?.toISOString() ?? null,
    };

    return { ok: true, stats };
  });

  app.get('/admin/settings', async () => ({ ok: true, settings: await getAllSettings() }));

  app.put('/admin/settings', async (req) => {
    const body = z.record(z.string().max(120), z.string().max(4000)).parse(req.body);
    for (const [key, value] of Object.entries(body)) await setSetting(key, value);
    return { ok: true, settings: await getAllSettings(), message: 'تنظیمات ذخیره شد.' };
  });

  app.delete('/admin/settings/:key', async (req) => {
    const { key } = req.params as { key: string };
    await deleteSetting(key);
    return { ok: true };
  });

  app.get('/admin/audit', async () => {
    const rows = await recentAudit(150);
    return {
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        action: r.action,
        entity: r.entity,
        entityKey: r.entityKey,
        detail: r.detail,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.get('/admin/recent-orders', async () => {
    const rows = await db
      .select()
      .from(orders)
      .where(isNull(orders.deletedAt))
      .orderBy(desc(orders.createdAt))
      .limit(8);
    return {
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        orderCode: r.orderCode,
        customerName: r.customerName,
        storeName: r.storeName,
        total: r.total,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });
};

export default routes;
