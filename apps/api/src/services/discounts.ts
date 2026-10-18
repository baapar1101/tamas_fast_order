import { randomBytes } from 'node:crypto';
import { and, count, eq, isNull, ne } from 'drizzle-orm';
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
