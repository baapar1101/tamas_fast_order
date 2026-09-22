import { and, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, orderPatchSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { orderItems, orders, users } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import { toOrderDTO } from '../../services/orders.js';
import { upsertOrderPayment } from '../../services/payments.js';
import { logAction } from '../../services/audit.js';

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum([...ORDER_STATUSES, 'all']).default('all'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_orders'));

  app.get('/admin/orders', async (req) => {
    const q = listQuery.parse(req.query);
    const filters: SQL[] = [isNull(orders.deletedAt)];

    if (q.status !== 'all') filters.push(eq(orders.status, q.status));
    if (q.from) filters.push(gte(orders.createdAt, new Date(q.from)));
    if (q.to) filters.push(lte(orders.createdAt, new Date(q.to)));
    if (q.q) {
      filters.push(
        or(
          ilike(orders.orderCode, `%${q.q}%`),
          ilike(orders.customerName, `%${q.q}%`),
          ilike(orders.phone, `%${q.q}%`),
          ilike(orders.storeName, `%${q.q}%`),
        )!,
      );
    }

    const where = and(...filters);

    const [rows, [total]] = await Promise.all([
      db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(q.perPage).offset(offsetOf(q)),
      db.select({ n: count() }).from(orders).where(where),
    ]);

    const items = rows.length
      ? await db
          .select()
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              rows.map((r) => r.id),
            ),
          )
      : [];

    const byOrder = new Map<number, typeof items>();
    for (const it of items) {
      const list = byOrder.get(it.orderId) ?? [];
      list.push(it);
      byOrder.set(it.orderId, list);
    }

    return {
      ok: true,
      items: rows.map((r) => toOrderDTO(r, byOrder.get(r.id) ?? [])),
      total: Number(total?.n ?? 0),
      page: q.page,
      perPage: q.perPage,
    };
  });

  app.get('/admin/orders/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!row) throw notFound('سفارش پیدا نشد.');
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const [customer] = row.userId
      ? await db.select().from(users).where(eq(users.id, row.userId)).limit(1)
      : [undefined];
    return { ok: true, order: toOrderDTO(row, items), customer: customer ?? null };
  });

  app.patch('/admin/orders/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = orderPatchSchema.parse(req.body);
    
    // Check old status if we are updating it to avoid duplicate SMS
    let oldStatus: string | undefined;
    let oldPaymentStatus: string | undefined;
    if (body.status || body.paymentStatus) {
      const [oldRow] = await db.select({ status: orders.status, paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, id));
      if (oldRow) {
        oldStatus = oldRow.status;
        oldPaymentStatus = oldRow.paymentStatus;
      }
    }

    const [updated] = await db
      .update(orders)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.paymentStatus ? { paymentStatus: body.paymentStatus } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    if (!updated) throw notFound('سفارش پیدا نشد.');

    if (body.paymentStatus) {
      await upsertOrderPayment(db, id, updated.userId ?? null, updated.total, body.paymentStatus);
    }
    
    if (updated.phone) {
      const { sendTemplatedSms } = await import('../../services/sms.js');

      // Status update SMS
      if (body.status && body.status !== oldStatus) {
        const templateKey = `sms_template_order_${body.status}`;
        sendTemplatedSms(updated.phone, templateKey, {
          order_code: updated.orderCode,
          name: updated.customerName || 'مشتری',
          status: ORDER_STATUS_LABELS[body.status],
        }).catch((err) => req.log.error({ err }, 'failed to send status sms'));
      }

      // Payment update SMS
      if (body.paymentStatus && body.paymentStatus === 'paid' && oldPaymentStatus !== 'paid') {
        sendTemplatedSms(updated.phone, 'sms_template_payment_paid', {
          order_code: updated.orderCode,
          name: updated.customerName || 'مشتری',
        }).catch((err) => req.log.error({ err }, 'failed to send payment sms'));
      }
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    await logAction(req.currentUser!.id, 'update', 'order', updated.orderCode, body as Record<string, unknown>);
    return { ok: true, order: toOrderDTO(updated, items) };
  });

  const bulkStatus = z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1).max(300),
    status: z.enum(ORDER_STATUSES),
  });

  app.post('/admin/orders/bulk-status', async (req) => {
    const body = bulkStatus.parse(req.body);
    const oldOrders = await db.select({ id: orders.id, status: orders.status }).from(orders).where(inArray(orders.id, body.ids));
    const changedIds = oldOrders.filter((o) => o.status !== body.status).map((o) => o.id);

    if (changedIds.length === 0) return { ok: true, changed: 0 };

    const changed = await db
      .update(orders)
      .set({ status: body.status, updatedAt: new Date() })
      .where(inArray(orders.id, changedIds))
      .returning({ id: orders.id, phone: orders.phone, orderCode: orders.orderCode, customerName: orders.customerName });

    const { sendTemplatedSms } = await import('../../services/sms.js');
    const templateKey = `sms_template_order_${body.status}`;
    for (const order of changed) {
      if (order.phone) {
        sendTemplatedSms(order.phone, templateKey, {
          order_code: order.orderCode,
          name: order.customerName || 'مشتری',
          status: ORDER_STATUS_LABELS[body.status],
        }).catch((err) => req.log.error({ err }, 'failed to send status sms bulk'));
      }
    }

    await logAction(req.currentUser!.id, 'bulk:status', 'order', null, { count: changed.length, status: body.status });
    return { ok: true, changed: changed.length };
  });

  /** CSV for accounting; Excel needs the BOM to read Persian correctly. */
  app.get('/admin/orders/export', async (req, reply) => {
    const q = listQuery.parse(req.query);
    const filters: SQL[] = [isNull(orders.deletedAt)];
    if (q.status !== 'all') filters.push(eq(orders.status, q.status));
    if (q.from) filters.push(gte(orders.createdAt, new Date(q.from)));
    if (q.to) filters.push(lte(orders.createdAt, new Date(q.to)));

    const rows = await db
      .select()
      .from(orders)
      .where(and(...filters))
      .orderBy(desc(orders.createdAt))
      .limit(5000);

    const items = rows.length
      ? await db
          .select()
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              rows.map((r) => r.id),
            ),
          )
      : [];
    const byOrder = new Map<number, typeof items>();
    for (const it of items) {
      const list = byOrder.get(it.orderId) ?? [];
      list.push(it);
      byOrder.set(it.orderId, list);
    }

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['order_code', 'date', 'customer', 'store', 'phone', 'address', 'status', 'total', 'items'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const line = (byOrder.get(r.id) ?? []).map((i) => `${i.title} (${i.color ?? '-'}) ×${i.qty}`).join(' | ');
      lines.push(
        [
          esc(r.orderCode),
          esc(r.createdAt.toISOString()),
          esc(r.customerName),
          esc(r.storeName ?? ''),
          esc(r.phone),
          esc(r.address),
          esc(r.status),
          esc(r.total),
          esc(line),
        ].join(','),
      );
    }

    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="orders-${Date.now()}.csv"`);
    return `﻿${lines.join('\n')}`;
  });

  /** Counts per status, for the tabs above the table. */
  app.get('/admin/orders/status-counts', async () => {
    const rows = await db
      .select({ status: orders.status, n: count() })
      .from(orders)
      .where(isNull(orders.deletedAt))
      .groupBy(orders.status);
    const counts = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
    const [totalRow] = await db.select({ n: count() }).from(orders).where(isNull(orders.deletedAt));
    return { ok: true, counts, total: Number(totalRow?.n ?? 0) };
  });

  app.get('/admin/orders/revenue', async () => {
    const rows = await db
      .select({
        day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
        n: count(),
        total: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
      })
      .from(orders)
      .where(and(isNull(orders.deletedAt), gte(orders.createdAt, new Date(Date.now() - 30 * 86_400_000))))
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);
    return { ok: true, days: rows.map((r) => ({ day: r.day, count: Number(r.n), total: Number(r.total) })) };
  });
};

export default routes;
