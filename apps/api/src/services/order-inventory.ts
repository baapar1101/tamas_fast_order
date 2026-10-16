import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { OrderStatus } from '@tamas/shared';
import { db } from '../db/client.js';
import { inventoryReservations, orders, products } from '../db/schema.js';
import { conflict, notFound } from '../lib/errors.js';
import { invalidateCatalog } from './catalog.js';
import { refundWalletOrder } from './wallet.js';
import {
  decideInventoryTransition,
  type InventoryQuantities,
  type InventoryTransitionEffect,
} from './inventory-policy.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface OrderStatusTransitionResult {
  order: typeof orders.$inferSelect;
  previousStatus: OrderStatus;
  inventoryEffect: InventoryTransitionEffect;
}

async function restoreReservedInventory(tx: Transaction, orderId: number): Promise<void> {
  const reservations = await tx
    .select()
    .from(inventoryReservations)
    .where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, 'reserved')))
    .for('update');
  if (reservations.length === 0) return;

  const productIds = [...new Set(reservations.map((row) => row.productId))].sort((a, b) => a - b);
  const productRows = await tx.select().from(products).where(inArray(products.id, productIds)).for('update');
  const byId = new Map(productRows.map((product) => [product.id, product]));
  const restores = new Map<number, InventoryQuantities>();
  for (const reservation of reservations) {
    const quantities = restores.get(reservation.productId) ?? { kerman: 0, tehran: 0, site: 0 };
    quantities[reservation.warehouse] += reservation.quantity;
    restores.set(reservation.productId, quantities);
  }

  for (const [productId, quantity] of restores) {
    const product = byId.get(productId);
    if (!product) throw conflict('یکی از کالاهای رزروشده دیگر در انبار پیدا نشد.');
    const nextKerman = product.kermanStock + quantity.kerman;
    const nextTehran = product.tehranStock + quantity.tehran;
    const usesSplitStock = product.kermanStock + product.tehranStock > 0 || quantity.kerman + quantity.tehran > 0;
    await tx.update(products).set({
      kermanStock: nextKerman,
      tehranStock: nextTehran,
      stock: usesSplitStock ? nextKerman + nextTehran : product.stock + quantity.site,
      updatedAt: new Date(),
    }).where(eq(products.id, productId));
  }

  const now = new Date();
  await tx.update(inventoryReservations).set({ status: 'released', releasedAt: now, updatedAt: now })
    .where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, 'reserved')));
}

export async function transitionOrderStatusInTransaction(
  tx: Transaction,
  orderId: number,
  nextStatus: OrderStatus,
): Promise<OrderStatusTransitionResult> {
  const [current] = await tx.select().from(orders)
    .where(and(eq(orders.id, orderId), isNull(orders.deletedAt)))
    .for('update')
    .limit(1);
  if (!current) throw notFound('سفارش پیدا نشد.');

  const previousStatus = current.status;
  const decision = decideInventoryTransition(previousStatus, nextStatus);
  if (!decision.valid) {
    if (decision.reason === 'cancelled_is_terminal') {
      throw conflict('سفارش لغوشده قابل فعال‌سازی مجدد نیست؛ یک سفارش جدید ثبت کنید.');
    }
    throw conflict('موجودی سفارش تأییدشده را نمی‌توان دوباره به حالت رزرو برگرداند.');
  }
  const inventoryEffect = decision.effect;
  const now = new Date();

  if (inventoryEffect === 'release') await restoreReservedInventory(tx, orderId);
  if (inventoryEffect === 'commit') {
    await tx.update(inventoryReservations).set({ status: 'committed', committedAt: now, updatedAt: now })
      .where(and(eq(inventoryReservations.orderId, orderId), eq(inventoryReservations.status, 'reserved')));
  }

  const [updated] = previousStatus === nextStatus
    ? [current]
    : await tx.update(orders).set({ status: nextStatus, updatedAt: now })
        .where(eq(orders.id, orderId)).returning();
  if (!updated) throw notFound('سفارش پیدا نشد.');
  if (nextStatus === 'cancelled' && previousStatus !== 'cancelled') await refundWalletOrder(tx, updated);

  return { order: updated, previousStatus, inventoryEffect };
}

export async function transitionOrderStatus(orderId: number, nextStatus: OrderStatus): Promise<OrderStatusTransitionResult> {
  const result = await db.transaction((tx) => transitionOrderStatusInTransaction(tx, orderId, nextStatus));
  if (result.inventoryEffect === 'release') invalidateCatalog();
  if (result.previousStatus !== result.order.status) notifyCustomerOrderStatus(result);
  return result;
}

export async function transitionOrdersStatus(orderIds: number[], nextStatus: OrderStatus): Promise<OrderStatusTransitionResult[]> {
  const ids = [...new Set(orderIds)].sort((a, b) => a - b);
  const results = await db.transaction(async (tx) => {
    const changed: OrderStatusTransitionResult[] = [];
    for (const id of ids) {
      const result = await transitionOrderStatusInTransaction(tx, id, nextStatus);
      if (result.previousStatus !== result.order.status) changed.push(result);
    }
    return changed;
  });
  if (results.some((result) => result.inventoryEffect === 'release')) invalidateCatalog();
  for (const result of results) notifyCustomerOrderStatus(result);
  return results;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'جدید',
  confirmed: 'تأییدشده',
  preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
};

function notifyCustomerOrderStatus(result: OrderStatusTransitionResult): void {
  const order = result.order;
  void import('./customer-telegram.js').then(({ sendCustomerTelegramNotification }) => sendCustomerTelegramNotification(
    order.userId,
    'order.status_changed',
    '📦 وضعیت سفارش تغییر کرد',
    `وضعیت سفارش ${order.orderCode} به «${ORDER_STATUS_LABELS[order.status]}» تغییر کرد.`,
  )).catch((err) => console.error('[Customer Telegram] order.status_changed failed:', err));

  if (result.previousStatus !== 'cancelled' && order.status === 'cancelled' && order.paymentMethod === 'wallet') {
    void import('./customer-telegram.js').then(({ sendCustomerTelegramNotification }) => sendCustomerTelegramNotification(
      order.userId,
      'wallet.changed',
      '↩️ بازگشت وجه به کیف پول',
      `${order.total.toLocaleString('fa-IR')} تومان بابت لغو سفارش ${order.orderCode} به کیف پول شما بازگشت.`,
    )).catch((err) => console.error('[Customer Telegram] wallet refund failed:', err));
  }
}
