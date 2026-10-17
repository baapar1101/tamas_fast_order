export const CUSTOMER_DISCOUNT_SETTING_KEY = 'CUSTOMER_DISCOUNT_CONFIG';
export const PAYMENT_ROUTING_SETTING_KEY = 'PAYMENT_ROUTING_CONFIG';

export type DiscountKind = 'percent' | 'fixed' | 'free_shipping';

export interface CustomerDiscountConfig {
  version: 1;
  enabled: boolean;
  autoGenerate: boolean;
  prefix: string;
  kind: DiscountKind;
  value: number;
  firstOrderOnly: boolean;
  startsAt: string | null;
  endsAt: string | null;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimit: number;
}

export interface PaymentAccountConfig {
  id: string;
  label: string;
  bankName: string;
  holder: string;
  cardNumber: string;
  iban: string;
  accountNumber: string;
  enabled: boolean;
  minAmount: number;
  maxAmount: number | null;
}

export interface PaymentRoutingConfig {
  version: 1;
  enabled: boolean;
  thresholdAmount: number;
  pendingMessage: string;
  accounts: PaymentAccountConfig[];
}

export const DEFAULT_CUSTOMER_DISCOUNT_CONFIG: CustomerDiscountConfig = {
  version: 1,
  enabled: false,
  autoGenerate: false,
  prefix: 'TAMAS',
  kind: 'percent',
  value: 5,
  firstOrderOnly: true,
  startsAt: null,
  endsAt: null,
  minOrderAmount: 0,
  maxDiscountAmount: null,
  usageLimit: 1,
};

export const DEFAULT_PAYMENT_ROUTING_CONFIG: PaymentRoutingConfig = {
  version: 1,
  enabled: true,
  thresholdAmount: 50_000_000,
  pendingMessage: 'مبلغ این فاکتور اعتباری بیش از ۵۰ میلیون تومان است. اطلاعات پرداخت به‌زودی از طریق پیامک، تلگرام یا بله برای شما ارسال خواهد شد.',
  accounts: [],
};

function parseObject<T>(raw: string | T | null | undefined): Partial<T> {
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<T> ?? {};
  } catch {
    return {};
  }
}

function amount(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function dateOrNull(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseCustomerDiscountConfig(raw: string | CustomerDiscountConfig | null | undefined): CustomerDiscountConfig {
  const value = parseObject<CustomerDiscountConfig>(raw);
  const kind: DiscountKind = ['percent', 'fixed', 'free_shipping'].includes(String(value.kind))
    ? value.kind as DiscountKind
    : DEFAULT_CUSTOMER_DISCOUNT_CONFIG.kind;
  return {
    ...DEFAULT_CUSTOMER_DISCOUNT_CONFIG,
    ...value,
    version: 1,
    prefix: String(value.prefix ?? DEFAULT_CUSTOMER_DISCOUNT_CONFIG.prefix).replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase() || 'TAMAS',
    kind,
    value: kind === 'percent' ? Math.min(100, amount(value.value, 5)) : amount(value.value, 0),
    minOrderAmount: amount(value.minOrderAmount, 0),
    maxDiscountAmount: value.maxDiscountAmount == null ? null : amount(value.maxDiscountAmount, 0),
    usageLimit: Math.max(1, Math.min(1000, amount(value.usageLimit, 1))),
    startsAt: dateOrNull(value.startsAt),
    endsAt: dateOrNull(value.endsAt),
  };
}

export function parsePaymentRoutingConfig(raw: string | PaymentRoutingConfig | null | undefined): PaymentRoutingConfig {
  const value = parseObject<PaymentRoutingConfig>(raw);
  return {
    ...DEFAULT_PAYMENT_ROUTING_CONFIG,
    ...value,
    version: 1,
    thresholdAmount: amount(value.thresholdAmount, DEFAULT_PAYMENT_ROUTING_CONFIG.thresholdAmount),
    pendingMessage: String(value.pendingMessage ?? DEFAULT_PAYMENT_ROUTING_CONFIG.pendingMessage).trim() || DEFAULT_PAYMENT_ROUTING_CONFIG.pendingMessage,
    accounts: Array.isArray(value.accounts) ? value.accounts.slice(0, 50).map((account, index) => ({
      id: String(account.id || `account-${index + 1}`).slice(0, 80),
      label: String(account.label || account.bankName || `حساب ${index + 1}`).slice(0, 160),
      bankName: String(account.bankName ?? '').slice(0, 160),
      holder: String(account.holder ?? '').slice(0, 160),
      cardNumber: String(account.cardNumber ?? '').slice(0, 40),
      iban: String(account.iban ?? '').slice(0, 40),
      accountNumber: String(account.accountNumber ?? '').slice(0, 60),
      enabled: account.enabled !== false,
      minAmount: amount(account.minAmount, 0),
      maxAmount: account.maxAmount == null ? null : amount(account.maxAmount, 0),
    })) : [],
  };
}

export function calculateDiscountAmount(kind: DiscountKind, value: number, subtotal: number, maxDiscountAmount: number | null): number {
  if (kind === 'free_shipping') return 0;
  const raw = kind === 'percent' ? Math.round(subtotal * Math.min(100, value) / 100) : value;
  return Math.max(0, Math.min(subtotal, maxDiscountAmount == null ? raw : Math.min(raw, maxDiscountAmount)));
}

export function isHighValueCreditPayment(finalAmount: number, kind: string | null | undefined, config: PaymentRoutingConfig): boolean {
  return config.enabled && finalAmount > config.thresholdAmount && (kind === 'cheque' || kind === 'daily');
}

export function formatPaymentAccount(account: PaymentAccountConfig): string {
  return [
    account.bankName && `${account.bankName}${account.holder ? ` - به نام ${account.holder}` : ''}`,
    account.cardNumber && `شماره کارت: ${account.cardNumber}`,
    account.iban && `شماره شبا: ${account.iban}`,
    account.accountNumber && `شماره حساب: ${account.accountNumber}`,
  ].filter(Boolean).join('\n');
}
