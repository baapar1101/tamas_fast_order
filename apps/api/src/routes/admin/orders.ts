import { and, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import * as xlsx from '@e965/xlsx';
import { z } from 'zod';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, orderPatchSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { orderItems, orders, users } from '../../db/schema.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import { toOrderDTO } from '../../services/orders.js';
import { upsertOrderPayment } from '../../services/payments.js';
import { logAction } from '../../services/audit.js';
import { refundWalletOrder } from '../../services/wallet.js';

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
    const [row] = await db.select().from(orders).where(and(eq(orders.id, id), isNull(orders.deletedAt))).limit(1);
    if (!row) throw notFound('سفارش پیدا نشد.');
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const [customer] = row.userId
      ? await db.select().from(users).where(eq(users.id, row.userId)).limit(1)
      : [undefined];
    return { ok: true, order: toOrderDTO(row, items), customer: customer ?? null };
  });

  /** Minimal one-column workbook used by Sepidar: customer header, then one SKU per unit. */
  app.get('/admin/orders/:id/sepidar-excel', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const [row] = await db.select().from(orders).where(and(eq(orders.id, id), isNull(orders.deletedAt))).limit(1);
    if (!row) throw notFound('سفارش پیدا نشد.');
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

    const data: string[][] = [[row.customerName || row.orderCode]];
    for (const item of items) {
      const sku = item.sku || item.productId;
      for (let index = 0; index < item.qty; index += 1) data.push([sku]);
    }
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(data), 'Sheet1');
    const buffer = Buffer.from(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    reply
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('content-disposition', `attachment; filename="order-${row.orderCode}.xlsx"`)
      .header('content-length', buffer.length);
    return reply.send(buffer);
  });

  app.patch('/admin/orders/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = orderPatchSchema.parse(req.body);
    
    // Check old status if we are updating it to avoid duplicate SMS
    let oldStatus: string | undefined;
    let oldPaymentStatus: string | undefined;
    if (body.status || body.paymentStatus) {
      const [oldRow] = await db.select({ status: orders.status, paymentStatus: orders.paymentStatus }).from(orders).where(and(eq(orders.id, id), isNull(orders.deletedAt)));
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
      .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
      .returning();
    if (!updated) throw notFound('سفارش پیدا نشد.');

    if (updated.status === 'cancelled') {
      await db.transaction((tx) => refundWalletOrder(tx, updated));
    }

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

    const { sendTelegramNotification } = await import('../../services/telegram.js');
    if (body.status && body.status !== oldStatus) {
      void sendTelegramNotification('order.status_changed', {
        title: '📦 تغییر وضعیت سفارش',
        fields: [
          { label: 'شماره سفارش', value: updated.orderCode },
          { label: 'مشتری', value: updated.customerName },
          { label: 'وضعیت قبلی', value: oldStatus ?? '-' },
          { label: 'وضعیت جدید', value: ORDER_STATUS_LABELS[body.status] },
        ],
      }).catch((err) => req.log.error({ err }, 'failed to send Telegram order status notification'));
    }
    if (body.paymentStatus === 'paid' && oldPaymentStatus !== 'paid') {
      void sendTelegramNotification('payment.paid', {
        title: '✅ پرداخت سفارش',
        fields: [
          { label: 'شماره سفارش', value: updated.orderCode },
          { label: 'مشتری', value: updated.customerName },
          { label: 'مبلغ', value: `${updated.total.toLocaleString('fa-IR')} تومان` },
        ],
      }).catch((err) => req.log.error({ err }, 'failed to send Telegram payment notification'));
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    await logAction(req.currentUser!.id, 'update', 'order', updated.orderCode, body as Record<string, unknown>);
    return { ok: true, order: toOrderDTO(updated, items) };
  });

  app.delete('/admin/orders/:id', async (req) => {
    const id = z.coerce.number().int().positive().parse((req.params as { id: string }).id);
    const [current] = await db
      .select({ id: orders.id, orderCode: orders.orderCode, status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
      .limit(1);
    if (!current) throw notFound('سفارش پیدا نشد یا قبلاً حذف شده است.');
    if (current.status !== 'cancelled') {
      throw badRequest('برای حفظ موجودی و سوابق مالی، ابتدا سفارش را لغو و سپس حذف کنید.');
    }

    await db.update(orders).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, id));
    await logAction(req.currentUser!.id, 'delete', 'order', current.orderCode, { mode: 'soft-delete' });
    return { ok: true, message: 'سفارش از فهرست حذف شد و سوابق مالی آن محفوظ ماند.' };
  });

  const bulkStatus = z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1).max(300),
    status: z.enum(ORDER_STATUSES),
  });

  app.post('/admin/orders/bulk-status', async (req) => {
    const body = bulkStatus.parse(req.body);
    const oldOrders = await db.select({ id: orders.id, status: orders.status, userId: orders.userId, total: orders.total, orderCode: orders.orderCode, paymentMethod: orders.paymentMethod }).from(orders).where(and(inArray(orders.id, body.ids), isNull(orders.deletedAt)));
    const changedIds = oldOrders.filter((o) => o.status !== body.status).map((o) => o.id);

    if (changedIds.length === 0) return { ok: true, changed: 0 };

    const changed = await db
      .update(orders)
      .set({ status: body.status, updatedAt: new Date() })
      .where(and(inArray(orders.id, changedIds), isNull(orders.deletedAt)))
      .returning({ id: orders.id, phone: orders.phone, orderCode: orders.orderCode, customerName: orders.customerName });

    if (body.status === 'cancelled') {
      const changedSet = new Set(changed.map((item) => item.id));
      await db.transaction(async (tx) => {
        for (const order of oldOrders) if (changedSet.has(order.id)) await refundWalletOrder(tx, order);
      });
    }

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

    const { sendTelegramNotification } = await import('../../services/telegram.js');
    void sendTelegramNotification('order.status_changed', {
      title: '📦 تغییر گروهی وضعیت سفارش‌ها',
      fields: [
        { label: 'تعداد سفارش', value: changed.length },
        { label: 'وضعیت جدید', value: ORDER_STATUS_LABELS[body.status] },
        { label: 'سفارش‌ها', value: changed.map((order) => order.orderCode).join('، ') },
      ],
    }).catch((err) => req.log.error({ err }, 'failed to send Telegram bulk order status notification'));

    await logAction(req.currentUser!.id, 'bulk:status', 'order', null, { count: changed.length, status: body.status });
    return { ok: true, changed: changed.length };
  });

  app.post('/admin/orders/bulk-delete', async (req) => {
    const body = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(300) }).parse(req.body);
    const current = await db
      .select({ id: orders.id, orderCode: orders.orderCode, status: orders.status })
      .from(orders)
      .where(and(inArray(orders.id, body.ids), isNull(orders.deletedAt)));
    const blocked = current.filter((order) => order.status !== 'cancelled');
    if (blocked.length > 0) {
      throw badRequest(`${blocked.length.toLocaleString('fa-IR')} سفارش هنوز لغو نشده است. ابتدا همه سفارش‌های انتخاب‌شده را لغو کنید.`, {
        orderCodes: blocked.slice(0, 10).map((order) => order.orderCode),
      });
    }
    if (current.length === 0) return { ok: true, changed: 0, message: 'سفارشی برای حذف پیدا نشد.' };

    const changed = await db
      .update(orders)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(orders.id, current.map((order) => order.id)))
      .returning({ id: orders.id });
    await logAction(req.currentUser!.id, 'bulk:delete', 'order', null, {
      count: changed.length,
      orderCodes: current.map((order) => order.orderCode),
      mode: 'soft-delete',
    });
    return { ok: true, changed: changed.length, message: `${changed.length.toLocaleString('fa-IR')} سفارش حذف شد.` };
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
