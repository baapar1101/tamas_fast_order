import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { OrderCreate, OrderDTO, OrderItemsReplace, Warehouse } from '@tamas/shared';
import { WAREHOUSE_LABELS } from '@tamas/shared';
import { db } from '../db/client.js';
import { inventoryReservations, orderItems, orders, products } from '../db/schema.js';
import { badRequest, conflict, notFound, profileIncomplete } from '../lib/errors.js';
import { invalidateCatalog } from './catalog.js';
import { missingProfileFields, type UserRow } from './auth.js';
import { upsertOrderPayment } from './payments.js';
import { applyWalletTransaction } from './wallet.js';
import { getSetting } from './settings.js';
import { allocateInventory, type InventoryQuantities } from './inventory-policy.js';

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;

export function toOrderDTO(row: OrderRow, items: OrderItemRow[]): OrderDTO {
  return {
    id: row.id,
    orderCode: row.orderCode,
    userId: row.userId ?? null,
    customerName: row.customerName,
    phone: row.phone,
    storeName: row.storeName,
    address: row.address,
    total: row.total,
    quantity: row.quantity,
    status: row.status,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
    note: row.note,
    acquisitionSource: row.acquisitionSource,
    acquisitionMedium: row.acquisitionMedium,
    acquisitionCampaign: row.acquisitionCampaign,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      sku: i.sku ?? null,
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

  const walletPayment = input.paymentMethod?.trim() === 'wallet';
  if (walletPayment) {
    const [walletEnabled, orderPaymentEnabled] = await Promise.all([
      getSetting('WALLET_ENABLED'),
      getSetting('WALLET_ORDER_PAYMENT_ENABLED'),
    ]);
    if (walletEnabled === 'false' || orderPaymentEnabled === 'false') {
      throw badRequest('پرداخت با کیف پول موقتاً غیرفعال است.');
    }
  }

  return db.transaction(async (tx) => {
    let rows = await tx
      .select()
      .from(products)
      .where(and(inArray(products.productId, productIds), isNull(products.deletedAt)))
      .for('update');

    const byId = new Map(rows.map((r) => [r.productId, r]));
    const additionalIds = new Set<string>();

    for (const row of rows) {
      if (row.type === 'bundle' && row.bundleItems && Array.isArray(row.bundleItems)) {
        for (const item of row.bundleItems) {
          if (!byId.has(item.productId)) additionalIds.add(item.productId);
        }
      }
    }

    if (additionalIds.size > 0) {
      const extraRows = await tx
        .select()
        .from(products)
        .where(and(inArray(products.productId, [...additionalIds]), isNull(products.deletedAt)))
        .for('update');
      for (const r of extraRows) {
        byId.set(r.productId, r);
      }
    }

    let total = 0;
    const toInsert: Array<typeof orderItems.$inferInsert> = [];
    const stockUpdates: Array<{ id: number; warehouse: Warehouse; qty: number }> = [];

    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product) throw badRequest(`محصول «${line.productId}» دیگر موجود نیست.`);
      if (product.status !== 'active') throw conflict(`«${product.title}» در حال حاضر قابل سفارش نیست.`);

      if (product.type === 'bundle' && product.bundleItems && Array.isArray(product.bundleItems)) {
        // Bundle stock validation
        for (const bItem of product.bundleItems) {
          const part = byId.get(bItem.productId);
          if (!part) throw badRequest(`جزء «${bItem.productId}» از باندل پیدا نشد.`);
          const requiredQty = line.qty * bItem.qty;
          const available = stockIn(part, line.warehouse);
          if (available < requiredQty) {
            throw conflict(
              `موجودی جزء «${part.title}» در ${WAREHOUSE_LABELS[line.warehouse]} برای این باندل کافی نیست (فقط ${available} عدد).`,
              { productId: part.productId, available },
            );
          }
          stockUpdates.push({ id: part.id, warehouse: line.warehouse, qty: requiredQty });
        }
        // Add bundle itself to order line items (but stockUpdates only has parts)
        total += product.price * line.qty;
        toInsert.push({
          orderId: 0,
          productId: product.productId,
          sku: product.sku,
          title: product.title,
          color: product.color,
          price: product.price,
          qty: line.qty,
          warehouse: line.warehouse,
        });
      } else {
        // Normal product stock validation
        const available = stockIn(product, line.warehouse);
        if (available < line.qty) {
          throw conflict(
            `موجودی «${product.title}» در ${WAREHOUSE_LABELS[line.warehouse]} فقط ${available} عدد است.`,
            { productId: product.productId, available },
          );
        }

        total += product.price * line.qty;
        toInsert.push({
          orderId: 0,
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
        quantity: lines.reduce((acc, l) => acc + l.qty, 0),
        status: walletPayment ? 'confirmed' : 'new',
        paymentStatus: walletPayment ? 'paid' : 'unpaid',
        paymentMethod: input.paymentMethod?.trim() || null,
        note: input.note?.trim() || null,
        acquisitionSource: input.attribution?.source?.trim().toLowerCase() || null,
        acquisitionMedium: input.attribution?.medium?.trim().toLowerCase() || null,
        acquisitionCampaign: input.attribution?.campaign?.trim() || null,
        acquisitionReferrer: input.attribution?.referrer?.trim() || null,
        acquisitionLandingPage: input.attribution?.landingPage?.trim() || null,
      })
      .returning();
    if (!order) throw new Error('order insert failed');

    const items = await tx
      .insert(orderItems)
      .values(toInsert.map((i) => ({ ...i, orderId: order.id })))
      .returning();

    if (walletPayment) {
      await applyWalletTransaction(tx, {
        userId: user.id,
        direction: 'debit',
        type: 'purchase',
        amount: total,
        orderId: order.id,
        description: `پرداخت سفارش ${order.orderCode}`,
        idempotencyKey: `order-purchase:${order.id}`,
      });
    }
    await upsertOrderPayment(tx, order.id, user.id, total, order.paymentStatus, walletPayment ? 'wallet' : undefined);

    if (stockUpdates.length > 0) {
      const deductions = new Map<
        number,
        { product: typeof products.$inferSelect; kerman: number; tehran: number; default: number }
      >();

      const productsByDbId = new Map([...byId.values()].map((product) => [product.id, product]));
      for (const update of stockUpdates) {
        const product = productsByDbId.get(update.id);
        if (!product) throw new Error(`product ${update.id} disappeared while creating the order`);

        const deduction = deductions.get(update.id) ?? { product, kerman: 0, tehran: 0, default: 0 };
        if (update.warehouse === 'kerman') deduction.kerman += update.qty;
        else if (update.warehouse === 'tehran') deduction.tehran += update.qty;
        else deduction.default += update.qty;
        deductions.set(update.id, deduction);
      }

      const reservationStatus = order.status === 'new' ? 'reserved' as const : 'committed' as const;
      const reservationRows: Array<typeof inventoryReservations.$inferInsert> = [];
      const now = new Date();
      for (const [productId, { product, kerman, tehran, default: defaultQty }] of deductions) {
        const requested: InventoryQuantities = { kerman, tehran, site: defaultQty };
        const { allocation } = allocateInventory(product, requested);
        const splitStock = product.kermanStock + product.tehranStock > 0;
        const physicalAvailable: InventoryQuantities = {
          kerman: product.kermanStock,
          tehran: product.tehranStock,
          site: product.stock,
        };
        for (const warehouse of ['kerman', 'tehran', 'site'] as const) {
          if (allocation[warehouse] > physicalAvailable[warehouse]) {
            throw conflict(
              `موجودی «${product.title}» در ${WAREHOUSE_LABELS[warehouse]} فقط ${physicalAvailable[warehouse]} عدد است.`,
              { productId: product.productId, available: physicalAvailable[warehouse] },
            );
          }
        }

        const nextKerman = product.kermanStock - allocation.kerman;
        const nextTehran = product.tehranStock - allocation.tehran;
        await tx.update(products).set({
          kermanStock: nextKerman,
          tehranStock: nextTehran,
          stock: splitStock ? nextKerman + nextTehran : product.stock - allocation.site,
          updatedAt: now,
        }).where(eq(products.id, productId));

        for (const warehouse of ['kerman', 'tehran', 'site'] as const) {
          if (allocation[warehouse] <= 0) continue;
          reservationRows.push({
            orderId: order.id,
            productId,
            warehouse,
            quantity: allocation[warehouse],
            status: reservationStatus,
            committedAt: reservationStatus === 'committed' ? now : null,
          });
        }
      }
      if (reservationRows.length > 0) await tx.insert(inventoryReservations).values(reservationRows);
    }

    invalidateCatalog();

    // Fire-and-forget CRM sync — failures are logged, never block the order.
    const { crmClient } = await import('../lib/crm.js');
    const { getCrmConfig } = await import('./settings.js');
    getCrmConfig().then(config => crmClient.pushOrder(toOrderDTO(order, items), config)).catch((err: unknown) => {
      // app.log?.warn?.({ err }, 'CRM pushOrder failed (non-blocking)');
    });

    // Fire-and-forget SMS notification
    if (user.phone) {
      import('./sms.js').then(({ sendTemplatedSms }) => {
        sendTemplatedSms(user.phone, 'sms_template_order_new', {
          order_code: order.orderCode,
          name: customerName,
        }).catch((err) => {
          console.error('[SMS] Failed to send new order sms:', err);
        });
      });
    }

    Promise.all([import('./telegram.js'), import('./telegram-operations.js')]).then(([{ sendTelegramNotification }, { telegramActionButtons }]) => {
      void sendTelegramNotification('order.created', {
        title: '🛒 سفارش جدید',
        fields: [
          { label: 'شماره سفارش', value: order.orderCode },
          { label: 'مشتری', value: customerName },
          { label: 'فروشگاه', value: order.storeName },
          { label: 'تلفن', value: order.phone },
          { label: 'مبلغ', value: `${order.total.toLocaleString('fa-IR')} تومان` },
          { label: 'تعداد', value: order.quantity },
          { label: 'روش پرداخت', value: order.paymentMethod },
        ],
        keyboard: telegramActionButtons.order(order.id),
      }).then((result) => {
        if (result.errors.length) console.error('[Telegram] order.created:', result.errors.join('; '));
      }).catch((err) => console.error('[Telegram] order.created failed:', err));
    });

    return toOrderDTO(order, items);
  });
}

export async function replaceOrderItems(orderId: number, input: OrderItemsReplace): Promise<{
  order: OrderDTO;
  previousTotal: number;
  previousItems: OrderItemRow[];
}> {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), isNull(orders.deletedAt)))
      .for('update')
      .limit(1);
    if (!order) throw notFound('سفارش پیدا نشد.');
    if (!['new', 'confirmed'].includes(order.status)) {
      throw conflict('فقط اقلام سفارش جدید یا تأییدشده قابل ویرایش است.');
    }
    if (order.paymentStatus === 'paid') {
      throw conflict('اقلام سفارش پرداخت‌شده قابل ویرایش نیست. ابتدا وضعیت پرداخت را اصلاح کنید.');
    }

    const previousItems = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .for('update');
    const previousReservations = await tx
      .select()
      .from(inventoryReservations)
      .where(and(
        eq(inventoryReservations.orderId, orderId),
        inArray(inventoryReservations.status, ['reserved', 'committed']),
      ))
      .for('update');

    const desired = new Map<string, { productId: string; warehouse: Warehouse; qty: number }>();
    for (const item of input.items) {
      const key = `${item.productId}::${item.warehouse}`;
      const current = desired.get(key);
      if (current) current.qty += item.qty;
      else desired.set(key, { productId: item.productId, warehouse: item.warehouse, qty: item.qty });
    }

    const requestedProductIds = [...new Set([
      ...previousItems.map((item) => item.productId),
      ...[...desired.values()].map((item) => item.productId),
    ])];
    const productRows = await tx
      .select()
      .from(products)
      .where(inArray(products.productId, requestedProductIds))
      .for('update');
    const productById = new Map(productRows.map((product) => [product.productId, product]));

    const componentIds = new Set<string>();
    for (const product of productRows) {
      if (product.type !== 'bundle') continue;
      for (const item of product.bundleItems ?? []) componentIds.add(item.productId);
    }
    const missingComponentIds = [...componentIds].filter((id) => !productById.has(id));
    if (missingComponentIds.length > 0) {
      const components = await tx
        .select()
        .from(products)
        .where(inArray(products.productId, missingComponentIds))
        .for('update');
      for (const product of components) productById.set(product.productId, product);
    }
    const knownProductDbIds = new Set([...productById.values()].map((product) => product.id));
    const missingReservedProductDbIds = [...new Set(previousReservations.map((row) => row.productId))]
      .filter((id) => !knownProductDbIds.has(id));
    if (missingReservedProductDbIds.length > 0) {
      const reservedProducts = await tx.select().from(products)
        .where(inArray(products.id, missingReservedProductDbIds))
        .for('update');
      for (const product of reservedProducts) productById.set(product.productId, product);
    }

    const previousByKey = new Map<string, OrderItemRow>();
    const previousQtyByKey = new Map<string, number>();
    for (const item of previousItems) {
      const key = `${item.productId}::${item.warehouse}`;
      if (!previousByKey.has(key)) previousByKey.set(key, item);
      previousQtyByKey.set(key, (previousQtyByKey.get(key) ?? 0) + item.qty);
    }

    const replacementRows: Array<typeof orderItems.$inferInsert> = [];
    for (const [key, item] of desired) {
      const product = productById.get(item.productId);
      if (!product) throw badRequest(`محصول «${item.productId}» پیدا نشد.`);
      const previous = previousByKey.get(key);
      const addsUnits = item.qty > (previousQtyByKey.get(key) ?? 0);
      if ((!previous || addsUnits) && (product.deletedAt || product.status !== 'active')) {
        throw conflict(`محصول «${product.title}» در حال حاضر قابل افزودن به سفارش نیست.`);
      }
      replacementRows.push({
        orderId,
        productId: product.productId,
        sku: previous?.sku ?? product.sku,
        title: previous?.title ?? product.title,
        color: previous?.color ?? product.color,
        price: previous?.price ?? product.price,
        qty: item.qty,
        warehouse: item.warehouse,
      });
    }

    type Need = { product: typeof products.$inferSelect; kerman: number; tehran: number; site: number };
    const inventoryNeeds = (lines: Array<{ productId: string; warehouse: Warehouse; qty: number }>) => {
      const needs = new Map<number, Need>();
      const add = (product: typeof products.$inferSelect, warehouse: Warehouse, qty: number) => {
        const need = needs.get(product.id) ?? { product, kerman: 0, tehran: 0, site: 0 };
        need[warehouse] += qty;
        needs.set(product.id, need);
      };
      for (const line of lines) {
        const product = productById.get(line.productId);
        if (!product) throw badRequest(`محصول «${line.productId}» پیدا نشد.`);
        if (product.type === 'bundle' && (product.bundleItems?.length ?? 0) > 0) {
          for (const bundleItem of product.bundleItems) {
            const component = productById.get(bundleItem.productId);
            if (!component) throw badRequest(`جزء «${bundleItem.productId}» از سبد پیدا نشد.`);
            add(component, line.warehouse, line.qty * bundleItem.qty);
          }
        } else {
          add(product, line.warehouse, line.qty);
        }
      }
      return needs;
    };

    const beforeNeeds = inventoryNeeds(previousItems);
    const afterNeeds = inventoryNeeds([...desired.values()]);
    const beforePhysical = new Map<number, InventoryQuantities>();
    for (const reservation of previousReservations) {
      const quantities = beforePhysical.get(reservation.productId) ?? { kerman: 0, tehran: 0, site: 0 };
      quantities[reservation.warehouse] += reservation.quantity;
      beforePhysical.set(reservation.productId, quantities);
    }
    // Compatibility for an order created before the reservation ledger existed.
    if (previousReservations.length === 0) {
      for (const [productId, need] of beforeNeeds) {
        const splitStock = need.product.kermanStock + need.product.tehranStock > 0;
        beforePhysical.set(productId, splitStock
          ? { kerman: need.kerman, tehran: need.tehran, site: need.site }
          : { kerman: 0, tehran: 0, site: need.kerman + need.tehran + need.site });
      }
    }

    const affectedProductIds = new Set([...beforePhysical.keys(), ...afterNeeds.keys()]);
    const nextReservations: Array<typeof inventoryReservations.$inferInsert> = [];
    const reservationStatus = order.status === 'new' ? 'reserved' as const : 'committed' as const;
    const now = new Date();
    for (const productDbId of affectedProductIds) {
      const before = beforePhysical.get(productDbId) ?? { kerman: 0, tehran: 0, site: 0 };
      const after = afterNeeds.get(productDbId);
      const product = after?.product ?? [...productById.values()].find((row) => row.id === productDbId);
      if (!product) throw conflict('یکی از کالاهای رزروشده دیگر در انبار پیدا نشد.');
      const restoredLevels = {
        kermanStock: product.kermanStock + before.kerman,
        tehranStock: product.tehranStock + before.tehran,
        stock: product.stock + before.site,
      };
      const requested: InventoryQuantities = {
        kerman: after?.kerman ?? 0,
        tehran: after?.tehran ?? 0,
        site: after?.site ?? 0,
      };
      const { allocation } = allocateInventory(restoredLevels, requested);
      const available: InventoryQuantities = {
        kerman: restoredLevels.kermanStock,
        tehran: restoredLevels.tehranStock,
        site: restoredLevels.stock,
      };
      for (const warehouse of ['kerman', 'tehran', 'site'] as const) {
        if (allocation[warehouse] > available[warehouse]) {
          throw conflict(
            `موجودی «${product.title}» در ${WAREHOUSE_LABELS[warehouse]} فقط ${available[warehouse]} عدد است.`,
            { productId: product.productId, available: available[warehouse] },
          );
        }
      }
      const nextKerman = restoredLevels.kermanStock - allocation.kerman;
      const nextTehran = restoredLevels.tehranStock - allocation.tehran;
      const usesSplitStock = restoredLevels.kermanStock + restoredLevels.tehranStock > 0;
      await tx
        .update(products)
        .set({
          kermanStock: nextKerman,
          tehranStock: nextTehran,
          stock: usesSplitStock ? nextKerman + nextTehran : restoredLevels.stock - allocation.site,
          updatedAt: now,
        })
        .where(eq(products.id, productDbId));

      for (const warehouse of ['kerman', 'tehran', 'site'] as const) {
        if (allocation[warehouse] <= 0) continue;
        nextReservations.push({
          orderId,
          productId: productDbId,
          warehouse,
          quantity: allocation[warehouse],
          status: reservationStatus,
          committedAt: reservationStatus === 'committed' ? now : null,
        });
      }
    }

    await tx.delete(inventoryReservations).where(eq(inventoryReservations.orderId, orderId));
    if (nextReservations.length > 0) await tx.insert(inventoryReservations).values(nextReservations);

    const total = replacementRows.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    const quantity = replacementRows.reduce((sum, item) => sum + Number(item.qty), 0);
    if (!Number.isSafeInteger(total) || total < 0) throw badRequest('مبلغ نهایی سفارش معتبر نیست.');

    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    const inserted = await tx.insert(orderItems).values(replacementRows).returning();
    const [updated] = await tx
      .update(orders)
      .set({ total, quantity, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    if (!updated) throw notFound('سفارش پیدا نشد.');
    await upsertOrderPayment(tx, updated.id, updated.userId ?? null, total, updated.paymentStatus);

    return {
      order: toOrderDTO(updated, inserted),
      previousTotal: order.total,
      previousItems,
    };
  });
  invalidateCatalog();
  return result;
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

/** Fetch an order by its orderCode (used for CRM manual sync). */
export async function getOrderByCode(orderCode: string): Promise<OrderDTO | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderCode, orderCode), isNull(orders.deletedAt)))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, row.id));

  return toOrderDTO(row, items);
}
