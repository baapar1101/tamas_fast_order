import { and, inArray, isNull } from 'drizzle-orm';
import { paymentAudienceForCategory, type PaymentPlanQuote, type PaymentTermsQuoteResult } from '@tamas/shared';
import { db } from '../db/client.js';
import { products } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { getPaymentTermsConfig, quotePaymentTerms } from './payment-terms.js';
import { getPaymentRoutingConfig, securePaymentPlan } from './payment-routing.js';

export interface CartQuoteItem {
  productId: string;
  qty: number;
}

export type CartPaymentQuote = PaymentTermsQuoteResult & {
  plans: PaymentPlanQuote[];
  partitions: Array<PaymentTermsQuoteResult & { productIds: string[] }>;
};

/**
 * The settlement options of a cart, priced from the database. The storefront
 * checkout (`POST /payment/terms/quote`) and the customer bot both call this,
 * so the cash-only Black Friday rule and the category audiences apply alike.
 */
export async function quoteCartPaymentTerms(items: CartQuoteItem[]): Promise<CartPaymentQuote> {
  const quantityByProduct = new Map<string, number>();
  for (const item of items) {
    quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.qty);
  }
  const ids = [...quantityByProduct.keys()];
  const rows = await db.select({
    productId: products.productId,
    categoryId: products.categoryId,
    price: products.price,
    sellType: products.sellType,
    ribbon: products.ribbon,
    status: products.status,
  }).from(products).where(and(inArray(products.productId, ids), isNull(products.deletedAt)));
  if (rows.length !== ids.length || rows.some((row) => row.status !== 'active')) {
    throw badRequest('یکی از کالاهای سبد دیگر قابل سفارش نیست. سبد خرید را تازه‌سازی کنید.');
  }
  const [config, routing] = await Promise.all([getPaymentTermsConfig(), getPaymentRoutingConfig()]);
  const quote = quotePaymentTerms(rows.map((row) => ({
    categoryId: row.categoryId,
    price: row.price,
    qty: quantityByProduct.get(row.productId) ?? 0,
    sellType: row.sellType,
    ribbon: row.ribbon,
  })), config);
  // Additive metadata for native checkout: mixed carts become separate invoices.
  // The server, not a category-name heuristic on the phone, owns this decision.
  const partitions = (['mobile', 'accessory'] as const).flatMap((audience) => {
    const partitionRows = rows.filter((row) => paymentAudienceForCategory(row.categoryId, config) === audience);
    if (partitionRows.length === 0) return [];
    const partitionQuote = quotePaymentTerms(partitionRows.map((row) => ({
      categoryId: row.categoryId, price: row.price,
      qty: quantityByProduct.get(row.productId) ?? 0, sellType: row.sellType, ribbon: row.ribbon,
    })), config);
    return [{ ...partitionQuote, productIds: partitionRows.map((row) => row.productId),
      plans: partitionQuote.plans.map((plan) => securePaymentPlan(plan, routing).plan) }];
  });
  return { ...quote, plans: quote.plans.map((plan) => securePaymentPlan(plan, routing).plan), partitions };
}
