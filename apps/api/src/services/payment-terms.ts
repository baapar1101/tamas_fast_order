import {
  BLACK_FRIDAY_RIBBON,
  PAYMENT_TERMS_SETTING_KEY,
  buildPaymentTermsQuote,
  buildRestrictedPaymentTermsQuote,
  parsePaymentTermsConfig,
  paymentAudienceForCategory,
  type PaymentPlanQuote,
  type PaymentTermsConfig,
  type PaymentTermsQuoteResult,
} from '@tamas/shared';
import { getSetting } from './settings.js';
import { getFestivalState } from './festival.js';

export interface PaymentTermsProductLine {
  categoryId: number | null;
  price: number;
  qty: number;
  sellType: string | null;
  ribbon?: string | null;
}

export async function getPaymentTermsConfig(): Promise<PaymentTermsConfig> {
  const [raw, festival] = await Promise.all([
    getSetting(PAYMENT_TERMS_SETTING_KEY),
    getFestivalState(),
  ]);
  return { ...parsePaymentTermsConfig(raw), festivalActive: festival.festivalPaymentTerms };
}

export function quotePaymentTerms(
  lines: PaymentTermsProductLine[],
  config: PaymentTermsConfig,
): PaymentTermsQuoteResult {
  if (lines.some((line) => line.ribbon === BLACK_FRIDAY_RIBBON)) {
    const regular = buildPaymentTermsQuote(
      lines.reduce((sum, line) => sum + line.price * line.qty, 0),
      lines.map((line) => paymentAudienceForCategory(line.categoryId, config)),
      config,
    );
    return {
      ...regular,
      plans: regular.plans.filter((plan) => plan.kind === 'cash'),
      enforcedSettlement: true,
      settlementPolicy: 'cash_only',
      message: 'سفارش دارای کالای ویژه بلک فرایدی فقط نقدی تسویه می‌شود.',
    };
  }
  return buildRestrictedPaymentTermsQuote(lines.map((line) => ({
    amount: line.price * line.qty,
    audience: paymentAudienceForCategory(line.categoryId, config),
    sellType: line.sellType,
  })), config);
}

export function blackFridayCashSelectionAllowed(
  lines: Pick<PaymentTermsProductLine, 'ribbon'>[],
  quote: PaymentTermsQuoteResult,
  paymentPlanId: string | undefined,
  paymentMethod: string | undefined,
): boolean {
  if (!lines.some((line) => line.ribbon === BLACK_FRIDAY_RIBBON)) return true;
  if (paymentMethod === 'wallet' || paymentMethod === 'credit_weekly') return false;
  return Boolean(paymentPlanId && quote.plans.some((plan) => plan.id === paymentPlanId && plan.kind === 'cash'));
}

export function selectPaymentPlan(
  quote: PaymentTermsQuoteResult,
  paymentPlanId: string | undefined,
): PaymentPlanQuote | null {
  if (!paymentPlanId) return null;
  return quote.plans.find((plan) => plan.id === paymentPlanId) ?? null;
}
