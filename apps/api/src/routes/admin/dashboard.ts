import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { DashboardStats } from '@tamas/shared';
import { db } from '../../db/client.js';
import { orderItems, orders, products, syncState, users } from '../../db/schema.js';
import { deleteSetting, getAllSettings, setSetting } from '../../services/settings.js';
import { recentAudit } from '../../services/audit.js';
import { configureTelegramWebhook, TELEGRAM_EVENTS, testTelegramGroup } from '../../services/telegram.js';
import { badRequest } from '../../lib/errors.js';

const routes: FastifyPluginAsync = async (app) => {
  // Operational overview is safe for every admin/operator; the sensitive
  // settings & audit endpoints stay locked behind manage_settings.
  app.get('/admin/stats', { preHandler: app.requireAdmin }, async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const liveProducts = isNull(products.deletedAt);

    const [
      [productRow],
      [activeRow],
      [outOfStockRow],
      [newProductRow],
      [userRow],
      [pendingUserRow],
      [newUserRow],
      [orderRow],
      [newOrderRow],
      [revenueRow],
      [revenue30Row],
      perDay,
      top,
      syncRows,
      usersPerDay,
      productsPerDay,
      revenuePerMonth,
      acquisitionRows,
      dashboardSettings,
    ] = await Promise.all([
      db.select({ n: count() }).from(products).where(liveProducts),
      db.select({ n: count() }).from(products).where(and(liveProducts, eq(products.status, 'active'))),
      db
        .select({ n: count() })
        .from(products)
        .where(and(liveProducts, sql`(${products.stock} + ${products.kermanStock} + ${products.tehranStock}) = 0`)),
      db.select({ n: count() }).from(products).where(and(liveProducts, gte(products.createdAt, thirtyDaysAgo))),
      db.select({ n: count() }).from(users).where(isNull(users.deletedAt)),
      db.select({ n: count() }).from(users).where(and(isNull(users.deletedAt), eq(users.isActive, false))),
      db.select({ n: count() }).from(users).where(and(isNull(users.deletedAt), gte(users.createdAt, thirtyDaysAgo))),
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
      db
        .select({ day: sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`, n: count() })
        .from(users)
        .where(and(isNull(users.deletedAt), gte(users.createdAt, thirtyDaysAgo)))
        .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`),
      db
        .select({ day: sql<string>`to_char(${products.createdAt}, 'YYYY-MM-DD')`, n: count() })
        .from(products)
        .where(and(isNull(products.deletedAt), gte(products.createdAt, thirtyDaysAgo)))
        .groupBy(sql`to_char(${products.createdAt}, 'YYYY-MM-DD')`),
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM-01')`,
          total: sql<string>`coalesce(sum(${orders.total}), 0)`,
        })
        .from(orders)
        .where(and(isNull(orders.deletedAt), sql`${orders.status} <> 'cancelled'`, gte(orders.createdAt, new Date(Date.now() - 550 * 86_400_000))))
        .groupBy(sql`date_trunc('month', ${orders.createdAt})`),
      db
        .select({
          source: sql<string>`coalesce(nullif(${orders.acquisitionSource}, ''), 'direct')`,
          n: count(),
          revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
        })
        .from(orders)
        .where(and(isNull(orders.deletedAt), sql`${orders.status} <> 'cancelled'`))
        .groupBy(sql`coalesce(nullif(${orders.acquisitionSource}, ''), 'direct')`)
        .orderBy(sql`count(*) desc`),
      getAllSettings(),
    ]);

    const defaultChannels: Array<{ id: string; label: string; color: string }> = [
      { id: 'google', label: 'گوگل و موتورهای جستجو', color: '#34d399' },
      { id: 'instagram', label: 'اینستاگرام', color: '#22d3ee' },
      { id: 'telegram', label: 'تلگرام', color: '#38bdf8' },
      { id: 'whatsapp', label: 'واتساپ', color: '#4ade80' },
      { id: 'eitaa', label: 'ایتا', color: '#f59e0b' },
      { id: 'direct', label: 'ورود مستقیم / نامشخص', color: '#94a3b8' },
    ];
    let configuredChannels = defaultChannels;
    try {
      const parsed = JSON.parse(dashboardSettings.ATTRIBUTION_CHANNELS || '[]') as Array<{ id?: unknown; label?: unknown; color?: unknown }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        configuredChannels = parsed
          .filter((item) => typeof item.id === 'string' && typeof item.label === 'string')
          .map((item) => ({ id: String(item.id).toLowerCase(), label: String(item.label), color: typeof item.color === 'string' ? item.color : '#94a3b8' }));
      }
    } catch { /* fall back to the built-in channel labels */ }
    const channelMap = new Map(configuredChannels.map((channel) => [channel.id, channel]));

    const orderDays = new Map(perDay.map((row) => [row.day, { orders: Number(row.n), revenue: Number(row.total) }]));
    const userDays = new Map(usersPerDay.map((row) => [row.day, Number(row.n)]));
    const productDays = new Map(productsPerDay.map((row) => [row.day, Number(row.n)]));
    const dailySeries = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (13 - index));
      const day = date.toISOString().slice(0, 10);
      const order = orderDays.get(day);
      return { day, revenue: order?.revenue ?? 0, orders: order?.orders ?? 0, users: userDays.get(day) ?? 0, products: productDays.get(day) ?? 0 };
    });

    const revenueMonths = new Map(revenuePerMonth.map((row) => [row.month.slice(0, 7), Number(row.total)]));
    const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      date.setMonth(date.getMonth() - (5 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const previousKey = `${date.getFullYear() - 1}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { month: `${key}-01`, current: revenueMonths.get(key) ?? 0, previous: revenueMonths.get(previousKey) ?? 0 };
    });

    const lastSync = syncRows
      .flatMap((s) => [s.lastPulledAt, s.lastPushedAt])
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const stats: DashboardStats = {
      productCount: Number(productRow?.n ?? 0),
      activeProductCount: Number(activeRow?.n ?? 0),
      outOfStockCount: Number(outOfStockRow?.n ?? 0),
      newProduct30: Number(newProductRow?.n ?? 0),
      userCount: Number(userRow?.n ?? 0),
      pendingUserCount: Number(pendingUserRow?.n ?? 0),
      newUser30: Number(newUserRow?.n ?? 0),
      orderCount: Number(orderRow?.n ?? 0),
      newOrderCount: Number(newOrderRow?.n ?? 0),
      revenueTotal: Number(revenueRow?.total ?? 0),
      revenueLast30Days: Number(revenue30Row?.total ?? 0),
      ordersPerDay: perDay.map((r) => ({ day: r.day, count: Number(r.n), total: Number(r.total) })),
      topProducts: top.map((r) => ({ title: r.title, qty: Number(r.qty), total: Number(r.total) })),
      lastSyncAt: lastSync?.toISOString() ?? null,
      dailySeries,
      monthlyRevenue,
      acquisitionSources: acquisitionRows.map((row, index) => {
        const channel = channelMap.get(row.source);
        return {
          source: row.source,
          label: channel?.label ?? row.source,
          color: channel?.color ?? ['#a78bfa', '#fb7185', '#fbbf24', '#60a5fa'][index % 4]!,
          count: Number(row.n),
          revenue: Number(row.revenue),
        };
      }),
    };

    return { ok: true, stats };
  });

  app.get(
    '/admin/settings',
    { preHandler: app.requirePermission('manage_settings') },
    async () => ({ ok: true, settings: await getAllSettings() }),
  );

  app.put('/admin/settings', { preHandler: app.requirePermission('manage_settings') }, async (req) => {
    const body = z.record(z.string().max(120), z.string().max(20_000)).parse(req.body);
    for (const [key, value] of Object.entries(body)) await setSetting(key, value);
    return { ok: true, settings: await getAllSettings(), message: 'تنظیمات ذخیره شد.' };
  });

  app.get('/admin/telegram/events', { preHandler: app.requirePermission('manage_settings') }, async () => ({
    ok: true,
    events: TELEGRAM_EVENTS,
  }));

  app.post('/admin/telegram/test', { preHandler: app.requirePermission('manage_settings') }, async (req) => {
    const { groupId } = z.object({ groupId: z.string().min(1).max(120) }).parse(req.body);
    try {
      const result = await testTelegramGroup(groupId);
      return { ok: true, ...result, message: `پیام آزمایشی به «${result.groupName}» ارسال شد.` };
    } catch (error) {
      req.log.warn({ err: error }, 'Telegram connection test failed');
      throw badRequest(`تست تلگرام ناموفق بود: ${(error as Error).message}`);
    }
  });

  app.post('/admin/telegram/webhook', { preHandler: app.requirePermission('manage_settings') }, async (req) => {
    const body = z.object({ webhookUrl: z.string().url().max(1000).optional() }).parse(req.body ?? {});
    const webhookUrl = body.webhookUrl || `${req.protocol}://${req.hostname}/api/telegram/webhook`;
    try {
      const result = await configureTelegramWebhook(webhookUrl);
      return {
        ok: true,
        ...result,
        message: result.enabled
          ? `عملیات ربات فعال شد. وب‌هوک به ${result.url} متصل است.`
          : 'عملیات ربات غیرفعال و وب‌هوک حذف شد.',
      };
    } catch (error) {
      req.log.warn({ err: error }, 'Telegram webhook setup failed');
      throw badRequest(`راه‌اندازی عملیات ربات ناموفق بود: ${(error as Error).message}`);
    }
  });

  app.delete(
    '/admin/settings/:key',
    { preHandler: app.requirePermission('manage_settings') },
    async (req) => {
      const { key } = req.params as { key: string };
      await deleteSetting(key);
      return { ok: true };
    },
  );

  app.get('/admin/audit', { preHandler: app.requirePermission('manage_settings') }, async () => {
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

  app.get('/admin/recent-orders', { preHandler: app.requireAdmin }, async () => {
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
