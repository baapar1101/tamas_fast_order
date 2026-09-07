import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { OrderCreate, OrderDTO, Warehouse } from '@tamas/shared';
import { WAREHOUSE_LABELS } from '@tamas/shared';
import { db } from '../db/client.js';
import { orderItems, orders, products } from '../db/schema.js';
import { badRequest, conflict, profileIncomplete } from '../lib/errors.js';
import { invalidateCatalog } from './catalog.js';
import { missingProfileFields, type UserRow } from './auth.js';

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;

export function toOrderDTO(row: OrderRow, items: OrderItemRow[]): OrderDTO {
  return {
    id: row.id,
    orderCode: row.orderCode,
    userId: row.userId,
    customerName: row.customerName,
    phone: row.phone,
    storeName: row.storeName,
    address: row.address,
    total: row.total,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      sku: i.sku,
      title: i.title,
      color: i.color,
      price: i.price,
      qty: i.qty,
      warehouse: i.warehouse,
    })),
  };
}

function orderCode(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `KP-${stamp}-${time}-${Math.floor(Math.random() * 900 + 100)}`;
}

/** Units available in one warehouse, falling back to the flat count. */
function stockIn(row: typeof products.$inferSelect, warehouse: Warehouse): number {
  const split = row.kermanStock + row.tehranStock;
  if (split > 0) {
    if (warehouse === 'kerman') return row.kermanStock;
    if (warehouse === 'tehran') return row.tehranStock;
    return split;
  }
  return row.stock;
}

/**
 * Prices and titles are read from the database, never from the request body —
 * the browser only ever says *which* product and how many. Stock is decremented
 * in the same transaction that writes the order, so two shoppers racing for the
 * last unit cannot both win.
 */
export async function createOrder(user: UserRow, input: OrderCreate): Promise<OrderDTO> {
  const missing = missingProfileFields(user);
  if (missing.length > 0) throw profileIncomplete(missing);

  // Collapse duplicate lines before touching the database.
  const wanted = new Map<string, { productId: string; warehouse: Warehouse; qty: number }>();
  for (const item of input.items) {
    const key = `${item.productId}::${item.warehouse}`;
    const existing = wanted.get(key);
    if (existing) existing.qty += item.qty;
    else wanted.set(key, { ...item });
  }
  const lines = [...wanted.values()];
  const productIds = [...new Set(lines.map((l) => l.productId))];

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(products)
      .where(and(inArray(products.productId, productIds), isNull(products.deletedAt)))
      .for('update');

    const byId = new Map(rows.map((r) => [r.productId, r]));

    let total = 0;
    const toInsert: Array<typeof orderItems.$inferInsert> = [];
    const stockUpdates: Array<{ id: number; warehouse: Warehouse; qty: number }> = [];

    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product) throw badRequest(`محصول «${line.productId}» دیگر موجود نیست.`);
      if (product.status !== 'active') throw conflict(`«${product.title}» در حال حاضر قابل سفارش نیست.`);

      const available = stockIn(product, line.warehouse);
      if (available < line.qty) {
        throw conflict(
          `موجودی «${product.title}» در ${WAREHOUSE_LABELS[line.warehouse]} فقط ${available} عدد است.`,
          { productId: product.productId, available },
        );
      }

      total += product.price * line.qty;
      toInsert.push({
        orderId: 0, // replaced below once the order row exists
        productId: product.productId,
        sku: product.sku,
        title: product.title,
        color: product.color,
        price: product.price,
        qty: line.qty,
        warehouse: line.warehouse,
      });
      stockUpdates.push({ id: product.id, warehouse: line.warehouse, qty: line.qty });
    }

    const customerName = [user.name, user.lastName].filter(Boolean).join(' ').trim() || user.phone;

    const [order] = await tx
      .insert(orders)
      .values({
        orderCode: orderCode(),
        userId: user.id,
        customerName,
        phone: user.phone,
        storeName: user.storeName || null,
        address: (input.address || user.address).trim(),
        total,
        status: 'new',
        note: input.note?.trim() || null,
      })
      .returning();
    if (!order) throw new Error('order insert failed');

    const items = await tx
      .insert(orderItems)
      .values(toInsert.map((i) => ({ ...i, orderId: order.id })))
      .returning();

    for (const update of stockUpdates) {
      const now = new Date();
      // `greatest(0, …)` keeps the column non-negative even if two paths ever
      // race outside this transaction.
      if (update.warehouse === 'kerman') {
        await tx
          .update(products)
          .set({ kermanStock: sql`greatest(0, ${products.kermanStock} - ${update.qty})`, updatedAt: now })
          .where(eq(products.id, update.id));
      } else if (update.warehouse === 'tehran') {
        await tx
          .update(products)
          .set({ tehranStock: sql`greatest(0, ${products.tehranStock} - ${update.qty})`, updatedAt: now })
          .where(eq(products.id, update.id));
      } else {
        await tx
          .update(products)
          .set({ stock: sql`greatest(0, ${products.stock} - ${update.qty})`, updatedAt: now })
          .where(eq(products.id, update.id));
      }
    }

    invalidateCatalog();
    return toOrderDTO(order, items);
  });
}

export async function listOrdersForUser(userId: number, limit = 50): Promise<OrderDTO[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), isNull(orders.deletedAt)))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const items = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((r) => r.id),
      ),
    );

  const byOrder = new Map<number, OrderItemRow[]>();
  for (const it of items) {
    const list = byOrder.get(it.orderId) ?? [];
    list.push(it);
    byOrder.set(it.orderId, list);
  }
  return rows.map((r) => toOrderDTO(r, byOrder.get(r.id) ?? []));
}
