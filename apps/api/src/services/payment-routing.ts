import {
  PAYMENT_ROUTING_SETTING_KEY,
  formatPaymentAccount,
  isHighValueCreditPayment,
  parsePaymentRoutingConfig,
  type PaymentPlanQuote,
  type PaymentRoutingConfig,
} from '@tamas/shared';
import { getSetting } from './settings.js';

export async function getPaymentRoutingConfig(): Promise<PaymentRoutingConfig> {
  return parsePaymentRoutingConfig(await getSetting(PAYMENT_ROUTING_SETTING_KEY));
}

export function securePaymentPlan(plan: PaymentPlanQuote, config: PaymentRoutingConfig): { plan: PaymentPlanQuote; pending: boolean } {
  if (!isHighValueCreditPayment(plan.finalAmount, plan.kind, config)) return { plan, pending: false };
  return {
    pending: true,
    plan: { ...plan, instructions: config.pendingMessage, requiresPaymentInfo: false },
  };
}

export function selectPaymentAccount(orderId: number, amount: number, config: PaymentRoutingConfig) {
  if (!config.enabled || amount <= config.thresholdAmount) return null;
  const eligible = config.accounts.filter((account) => account.enabled
    && amount >= account.minAmount
    && (account.maxAmount == null || amount <= account.maxAmount));
  if (eligible.length === 0) return null;
  return eligible[Math.abs(orderId) % eligible.length] ?? null;
}

export { formatPaymentAccount };
