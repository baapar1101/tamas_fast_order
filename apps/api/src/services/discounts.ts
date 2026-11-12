import { randomBytes } from 'node:crypto';
import { and, count, eq, isNull, like, ne, sql } from 'drizzle-orm';
import {
  CUSTOMER_DISCOUNT_SETTING_KEY,
  calculateDiscountAmount,
  parseCustomerDiscountConfig,
  type CustomerDiscountConfig,
} from '@tamas/shared';
import { db } from '../db/client.js';
import { discountCodes, orders, users } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { getSetting } from './settings.js';
import { sendCustomerNotification } from './customer-messaging.js';
import { sendTemplatedSms } from './sms.js';

export const FIRST_PURCHASE_REWARD = {
  amount: 1_000_000,
  minOrderAmount: 5_000_000,
  codePrefix: 'FIRST1M',
} as const;

/** A paid, non-cancelled first order earns one code for the next purchase. */
export function isFirstPaidPurchase(paymentStatus: string, status: string, paidOrderCount: number, historicalBackfill = false): boolean {
  return paymentStatus === 'paid' && status !== 'cancelled'
    && (paidOrderCount === 1 || (historicalBackfill && paidOrderCount > 1));
}

/** Called after a successful payment is committed, including wallet and manual payments. */
export async function issueFirstPurchaseReward(orderId: number, options: { historicalBackfill?: boolean } = {}): Promise<boolean> {
  const issued = await db.transaction(async (tx) => {
    const [order] = await tx.select({
      userId: orders.userId,
      paymentStatus: orders.paymentStatus,
      status: orders.status,
      deletedAt: orders.deletedAt,
      phone: users.phone,
      name: users.name,
      role: users.role,
      userDeletedAt: users.deletedAt,
    }).from(orders).innerJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, orderId)).limit(1);
    if (!order?.userId || order.deletedAt || order.userDeletedAt || order.role !== 'customer' || order.paymentStatus !== 'paid') return null;

    // Serialise issuance for one customer across the online, wallet and admin paths.
    await tx.execute(sql`select pg_advisory_xact_lock(1947301, ${order.userId})`);
    const [existing] = await tx.select({ id: discountCodes.id }).from(discountCodes)
      .where(and(eq(discountCodes.userId, order.userId), like(discountCodes.code, `${FIRST_PURCHASE_REWARD.codePrefix}-%`)))
      .limit(1);
    if (existing) return null;

    const [paid] = await tx.select({ value: count() }).from(orders).where(and(
      eq(orders.userId, order.userId),
      eq(orders.paymentStatus, 'paid'),
      ne(orders.status, 'cancelled'),
      isNull(orders.deletedAt),
    ));
    if (!isFirstPaidPurchase(order.paymentStatus, order.status, Number(paid?.value ?? 0), options.historicalBackfill)) return null;

    const [code] = await tx.insert(discountCodes).values({
      userId: order.userId,
      code: `${FIRST_PURCHASE_REWARD.codePrefix}-${randomBytes(8).toString('hex').toUpperCase()}`,
      kind: 'fixed',
      value: FIRST_PURCHASE_REWARD.amount,
      firstOrderOnly: false,
      minOrderAmount: FIRST_PURCHASE_REWARD.minOrderAmount,
      usageLimit: 1,
    }).returning({ code: discountCodes.code });
    return code ? { ...code, userId: order.userId, phone: order.phone, name: order.name } : null;
  });
  if (!issued) return false;

  const message = `از اولین خریدتان متشکریم. کد تخفیف ۱٬۰۰۰٬۰۰۰ تومانی شما برای خرید بعدی با حداقل مبلغ ۵٬۰۰۰٬۰۰۰ تومان: ${issued.code}؛ این کد یک بار قابل استفاده است.`;
  const deliveries = await Promise.allSettled([
    sendCustomerNotification(issued.userId, 'discount.created', '🎁 هدیه خرید اول شما', message),
    issued.phone ? sendTemplatedSms(issued.phone, 'sms_template_first_purchase_reward', {
      name: issued.name || 'همکار گرامی',
      code: issued.code,
      amount: '۱٬۰۰۰٬۰۰۰',
      min_order: '۵٬۰۰۰٬۰۰۰',
    }, '{name}، از اولین خریدتان متشکریم. کد تخفیف {amount} تومانی خرید بعدی شما: {code}؛ حداقل خرید {min_order} تومان. استفاده فقط یک بار.') : Promise.resolve({ ok: false, error: 'شماره همراه ثبت نشده است.' }),
  ]);
  for (const result of deliveries) {
    if (result.status === 'rejected') console.error('[first purchase reward] delivery failed', result.reason);
    else if ('error' in result.value && result.value.error) console.error('[first purchase reward] delivery:', result.value.error);
  }
  return true;
}

export interface AppliedDiscount {
  id: number;
  code: string;
  amount: number;
  freeShipping: boolean;
}

export async function getCustomerDiscountConfig(): Promise<CustomerDiscountConfig> {
  return parseCustomerDiscountConfig(await getSetting(CUSTOMER_DISCOUNT_SETTING_KEY));
}

function codeSuffix(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}

export async function ensureCustomerDiscount(userId: number, createdBy?: number): Promise<typeof discountCodes.$inferSelect | null> {
  const config = await getCustomerDiscountConfig();
  if (!config.enabled || !config.autoGenerate) return null;
  const [existing] = await db.select().from(discountCodes)
    .where(and(eq(discountCodes.userId, userId), eq(discountCodes.isActive, true)))
    .limit(1);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [created] = await db.insert(discountCodes).values({
        userId,
        code: `${config.prefix}-${codeSuffix()}`,
        kind: config.kind,
        value: config.value,
        firstOrderOnly: config.firstOrderOnly,
        minOrderAmount: config.minOrderAmount,
        maxDiscountAmount: config.maxDiscountAmount,
        startsAt: config.startsAt ? new Date(config.startsAt) : null,
        endsAt: config.endsAt ? new Date(config.endsAt) : null,
        usageLimit: config.usageLimit,
        createdBy: createdBy ?? null,
      }).returning();
      if (created) return created;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  return null;
}

export async function validateCustomerDiscount(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: number,
  rawCode: string,
  subtotal: number,
): Promise<AppliedDiscount> {
  const code = rawCode.trim().toUpperCase();
  const [row] = await tx.select().from(discountCodes).where(and(
    eq(discountCodes.code, code),
    eq(discountCodes.userId, userId),
  )).for('update').limit(1);
  if (!row || !row.isActive) throw badRequest('کد تخفیف برای این حساب معتبر نیست.');
  const now = new Date();
  if (row.startsAt && row.startsAt > now) throw badRequest('زمان استفاده از این کد تخفیف هنوز شروع نشده است.');
  if (row.endsAt && row.endsAt < now) throw badRequest('اعتبار این کد تخفیف به پایان رسیده است.');
  if (row.usedCount >= row.usageLimit) throw badRequest('سقف استفاده از این کد تخفیف تکمیل شده است.');
  if (subtotal < row.minOrderAmount) throw badRequest(`حداقل مبلغ سفارش برای این کد ${row.minOrderAmount.toLocaleString('fa-IR')} تومان است.`);
  if (row.firstOrderOnly) {
    const [prior] = await tx.select({ value: count() }).from(orders).where(and(
      eq(orders.userId, userId),
      isNull(orders.deletedAt),
      ne(orders.status, 'cancelled'),
    ));
    if (Number(prior?.value ?? 0) > 0) throw badRequest('این کد فقط برای اولین سفارش قابل استفاده است.');
  }
  return {
    id: row.id,
    code: row.code,
    amount: calculateDiscountAmount(row.kind, row.value, subtotal, row.maxDiscountAmount),
    freeShipping: row.kind === 'free_shipping',
  };
}

export async function generateDiscountsForMissingCustomers(createdBy: number): Promise<number> {
  const config = await getCustomerDiscountConfig();
  if (!config.enabled) throw badRequest('ابتدا تولید کد تخفیف را در تنظیمات فعال کنید.');
  const customerRows = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'customer'), isNull(users.deletedAt)));
  const existing = await db.select({ userId: discountCodes.userId }).from(discountCodes).where(eq(discountCodes.isActive, true));
  const occupied = new Set(existing.map((item) => item.userId));
  let created = 0;
  for (const customer of customerRows) {
    if (occupied.has(customer.id)) continue;
    const previousAutoGenerate = config.autoGenerate;
    if (!previousAutoGenerate) {
      // Bulk generation is an explicit admin action even when automatic generation is disabled.
      const [row] = await db.insert(discountCodes).values({
        userId: customer.id, code: `${config.prefix}-${codeSuffix()}`, kind: config.kind, value: config.value,
        firstOrderOnly: config.firstOrderOnly, minOrderAmount: config.minOrderAmount,
        maxDiscountAmount: config.maxDiscountAmount, startsAt: config.startsAt ? new Date(config.startsAt) : null,
        endsAt: config.endsAt ? new Date(config.endsAt) : null, usageLimit: config.usageLimit, createdBy,
      }).returning({ id: discountCodes.id });
      if (row) created += 1;
    } else if (await ensureCustomerDiscount(customer.id, createdBy)) created += 1;
  }
  return created;
}
