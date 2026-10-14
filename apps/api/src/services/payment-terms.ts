import {
  PAYMENT_TERMS_SETTING_KEY,
  buildPaymentTermsQuote,
  parsePaymentTermsConfig,
  paymentAudienceForCategory,
  type PaymentPlanQuote,
  type PaymentTermsConfig,
  type PaymentTermsQuoteResult,
} from '@tamas/shared';
import { getSetting } from './settings.js';

export interface PaymentTermsProductLine {
  categoryId: number | null;
  price: number;
  qty: number;
}

export async function getPaymentTermsConfig(): Promise<PaymentTermsConfig> {
  return parsePaymentTermsConfig(await getSetting(PAYMENT_TERMS_SETTING_KEY));
}

export function quotePaymentTerms(
  lines: PaymentTermsProductLine[],
  config: PaymentTermsConfig,
): PaymentTermsQuoteResult {
  const baseAmount = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const audiences = lines.map((line) => paymentAudienceForCategory(line.categoryId, config));
  return buildPaymentTermsQuote(baseAmount, audiences, config);
}

export function selectPaymentPlan(
  quote: PaymentTermsQuoteResult,
  paymentPlanId: string | undefined,
): PaymentPlanQuote | null {
  if (!paymentPlanId) return null;
  return quote.plans.find((plan) => plan.id === paymentPlanId) ?? null;
}
