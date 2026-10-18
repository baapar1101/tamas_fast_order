import {
  PAYMENT_TERMS_SETTING_KEY,
  buildRestrictedPaymentTermsQuote,
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
  sellType: string | null;
}

export async function getPaymentTermsConfig(): Promise<PaymentTermsConfig> {
  return parsePaymentTermsConfig(await getSetting(PAYMENT_TERMS_SETTING_KEY));
}

export function quotePaymentTerms(
  lines: PaymentTermsProductLine[],
  config: PaymentTermsConfig,
): PaymentTermsQuoteResult {
  return buildRestrictedPaymentTermsQuote(lines.map((line) => ({
    amount: line.price * line.qty,
    audience: paymentAudienceForCategory(line.categoryId, config),
    sellType: line.sellType,
  })), config);
}

export function selectPaymentPlan(
  quote: PaymentTermsQuoteResult,
  paymentPlanId: string | undefined,
): PaymentPlanQuote | null {
  if (!paymentPlanId) return null;
  return quote.plans.find((plan) => plan.id === paymentPlanId) ?? null;
}
