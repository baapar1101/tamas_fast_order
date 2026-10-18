import {
  PAYMENT_ROUTING_SETTING_KEY,
  formatPaymentAccount,
  parsePaymentRoutingConfig,
  requiresManualPaymentInstructions,
  selectPaymentAccount,
  type PaymentPlanQuote,
  type PaymentRoutingConfig,
} from '@tamas/shared';
import { getSetting } from './settings.js';

export async function getPaymentRoutingConfig(): Promise<PaymentRoutingConfig> {
  return parsePaymentRoutingConfig(await getSetting(PAYMENT_ROUTING_SETTING_KEY));
}

export function securePaymentPlan(plan: PaymentPlanQuote, config: PaymentRoutingConfig): { plan: PaymentPlanQuote; pending: boolean } {
  if (!requiresManualPaymentInstructions(plan.finalAmount, config)) return { plan, pending: false };
  return {
    pending: true,
    plan: { ...plan, instructions: config.pendingMessage, requiresPaymentInfo: false },
  };
}

export { formatPaymentAccount, selectPaymentAccount };
