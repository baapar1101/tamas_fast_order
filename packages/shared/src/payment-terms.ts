export const PAYMENT_TERMS_SETTING_KEY = 'PAYMENT_TERMS_CONFIG';

export type PaymentAudience = 'accessory' | 'mobile';
export type PaymentPlanKind = 'cash' | 'cheque' | 'daily';

export interface AccessoryPaymentRule {
  id: string;
  label: string;
  enabled: boolean;
  group: 'monthly' | 'bimonthly';
  termMonths: number;
  upfrontPercent: number;
  discountPercent: number;
}

export interface MobileInstallmentRule {
  day: number;
  percent: number | null;
}

export interface MobilePaymentRule {
  id: string;
  label: string;
  enabled: boolean;
  days: number;
  receivedLabel: string;
  dailyServicePercent: number;
  totalServicePercent: number;
  installments: MobileInstallmentRule[];
}

export interface PaymentTermsConfig {
  version: 1;
  enabled: boolean;
  mobileCategoryIds: number[];
  accessory: {
    enabled: boolean;
    accountInstructions: string;
    rules: AccessoryPaymentRule[];
  };
  mobile: {
    enabled: boolean;
    cashAccountInstructions: string;
    dailyAccountInstructions: string;
    rules: MobilePaymentRule[];
  };
}

export interface PaymentScheduleItem {
  dueLabel: string;
  percent: number | null;
  amount: number | null;
  optional: boolean;
}

export interface PaymentPlanQuote {
  id: string;
  label: string;
  description: string;
  audience: PaymentAudience;
  kind: PaymentPlanKind;
  baseAmount: number;
  finalAmount: number;
  adjustmentAmount: number;
  discountPercent: number;
  serviceFeePercent: number;
  upfrontPercent: number | null;
  upfrontAmount: number | null;
  schedule: PaymentScheduleItem[];
  instructions: string;
  requiresPaymentInfo: boolean;
}

export interface PaymentTermsQuoteResult {
  audience: PaymentAudience | 'mixed' | null;
  baseAmount: number;
  plans: PaymentPlanQuote[];
  message?: string;
}

const accessoryRules = (
  group: AccessoryPaymentRule['group'],
  upfront: number[],
  discount: number[],
): AccessoryPaymentRule[] => {
  const prefix = group === 'monthly' ? 'accessory-monthly' : 'accessory-bimonthly';
  const groupLabel = group === 'monthly' ? 'ماه‌به‌ماه' : 'دوماه‌به‌دوماه';
  return upfront.map((upfrontPercent, index) => {
    const termMonths = index;
    return {
      id: `${prefix}-${termMonths}`,
      label: termMonths === 0 ? `نقدی (${groupLabel})` : `چک ${termMonths} ماهه - ${groupLabel}`,
      enabled: termMonths === 0 || upfrontPercent > 0 || (discount[index] ?? 0) > 0,
      group,
      termMonths,
      upfrontPercent,
      discountPercent: discount[index] ?? 0,
    };
  });
};

export const DEFAULT_PAYMENT_TERMS_CONFIG: PaymentTermsConfig = {
  version: 1,
  enabled: true,
  mobileCategoryIds: [2],
  accessory: {
    enabled: true,
    accountInstructions: 'شماره حساب ثابت حمید برای پرداخت کالاهای جانبی بلامانع است.\nبانک ملت - به نام حمید قاسم زاده\nشماره کارت: 6104-3311-4877-4871\nشماره شبا: IR980120010000007697585463',
    rules: [
      ...accessoryRules('monthly', [100, 0, 0, 20, 30, 35, 40], [10, 5, 3, 0, 0, 0, 0]),
      ...accessoryRules('bimonthly', [100, 0, 20, 0, 35, 0, 50], [10, 5, 0, 0, 0, 0, 0]),
    ],
  },
  mobile: {
    enabled: true,
    cashAccountInstructions: 'برای فاکتور نقدی، واریز به حساب حمید بلامانع است.\nبانک ملت - به نام حمید قاسم زاده\nشماره کارت: 6104-3311-4877-4871\nشماره شبا: IR980120010000007697585463',
    dailyAccountInstructions: 'شماره حساب دریافت سررسیدهای روزانه متغیر است و توسط واحد مالی اعلام می‌شود.',
    rules: [
      {
        id: 'mobile-cash', label: 'نقدی', enabled: true, days: 0, receivedLabel: '۱۰۰٪',
        dailyServicePercent: 0, totalServicePercent: 0, installments: [],
      },
      {
        id: 'mobile-2-days', label: 'تسویه ۲ روزه', enabled: true, days: 2, receivedLabel: 'اختیاری',
        dailyServicePercent: 0, totalServicePercent: 0,
        installments: [{ day: 1, percent: null }, { day: 2, percent: 100 }],
      },
      {
        id: 'mobile-5-days', label: 'تسویه ۵ روزه', enabled: true, days: 5, receivedLabel: 'اختیاری',
        dailyServicePercent: 0.25, totalServicePercent: 1.3,
        installments: [
          { day: 1, percent: null }, { day: 2, percent: 20 }, { day: 3, percent: 20 },
          { day: 4, percent: 20 }, { day: 5, percent: 20 },
        ],
      },
      {
        id: 'mobile-7-days', label: 'تسویه ۷ روزه', enabled: true, days: 7, receivedLabel: 'اختیاری',
        dailyServicePercent: 0.28, totalServicePercent: 1.96,
        installments: [
          { day: 1, percent: null }, { day: 2, percent: 15 }, { day: 3, percent: null },
          { day: 4, percent: 20 }, { day: 5, percent: null }, { day: 6, percent: 25 },
          { day: 7, percent: 40 },
        ],
      },
      {
        id: 'mobile-10-days', label: 'تسویه ۱۰ روزه', enabled: true, days: 10, receivedLabel: 'اختیاری',
        dailyServicePercent: 0.35, totalServicePercent: 3.5,
        installments: [
          { day: 1, percent: null }, { day: 2, percent: 10 }, { day: 3, percent: null },
          { day: 4, percent: 10 }, { day: 5, percent: null }, { day: 6, percent: 20 },
          { day: 7, percent: null }, { day: 8, percent: 30 }, { day: 9, percent: null },
          { day: 10, percent: 30 },
        ],
      },
      {
        id: 'mobile-15-days', label: 'تسویه ۱۵ روزه (به‌زودی)', enabled: false, days: 15,
        receivedLabel: 'اختیاری', dailyServicePercent: 0, totalServicePercent: 0, installments: [],
      },
    ],
  },
};

const numberInRange = (value: unknown, fallback: number, min = 0, max = 100): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const text = (value: unknown, fallback: string): string => typeof value === 'string' ? value : fallback;

/** Parse the admin JSON defensively so an incomplete edit cannot break checkout. */
export function parsePaymentTermsConfig(raw: string | PaymentTermsConfig | null | undefined): PaymentTermsConfig {
  let parsed: Partial<PaymentTermsConfig> | null = null;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) as Partial<PaymentTermsConfig> : raw ?? null;
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object') return structuredClone(DEFAULT_PAYMENT_TERMS_CONFIG);

  const defaults = DEFAULT_PAYMENT_TERMS_CONFIG;
  const accessory = parsed.accessory ?? defaults.accessory;
  const mobile = parsed.mobile ?? defaults.mobile;
  const parsedAccessoryRules = Array.isArray(accessory.rules) ? accessory.rules : defaults.accessory.rules;
  const parsedMobileRules = Array.isArray(mobile.rules) ? mobile.rules : defaults.mobile.rules;

  return {
    version: 1,
    enabled: parsed.enabled !== false,
    mobileCategoryIds: Array.isArray(parsed.mobileCategoryIds)
      ? [...new Set(parsed.mobileCategoryIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
      : [...defaults.mobileCategoryIds],
    accessory: {
      enabled: accessory.enabled !== false,
      accountInstructions: text(accessory.accountInstructions, defaults.accessory.accountInstructions),
      rules: parsedAccessoryRules.map((rule, index) => ({
        id: text(rule?.id, `accessory-rule-${index}`),
        label: text(rule?.label, `شرایط پرداخت ${index + 1}`),
        enabled: rule?.enabled !== false,
        group: rule?.group === 'bimonthly' ? 'bimonthly' : 'monthly',
        termMonths: Math.round(numberInRange(rule?.termMonths, 0, 0, 36)),
        upfrontPercent: numberInRange(rule?.upfrontPercent, 0),
        discountPercent: numberInRange(rule?.discountPercent, 0),
      })),
    },
    mobile: {
      enabled: mobile.enabled !== false,
      cashAccountInstructions: text(mobile.cashAccountInstructions, defaults.mobile.cashAccountInstructions),
      dailyAccountInstructions: text(mobile.dailyAccountInstructions, defaults.mobile.dailyAccountInstructions),
      rules: parsedMobileRules.map((rule, index) => ({
        id: text(rule?.id, `mobile-rule-${index}`),
        label: text(rule?.label, `تسویه ${index + 1}`),
        enabled: rule?.enabled !== false,
        days: Math.round(numberInRange(rule?.days, 0, 0, 365)),
        receivedLabel: text(rule?.receivedLabel, 'اختیاری'),
        dailyServicePercent: numberInRange(rule?.dailyServicePercent, 0),
        totalServicePercent: numberInRange(rule?.totalServicePercent, 0),
        installments: Array.isArray(rule?.installments)
          ? rule.installments.map((item, itemIndex) => ({
              day: Math.round(numberInRange(item?.day, itemIndex + 1, 1, 365)),
              percent: item?.percent == null ? null : numberInRange(item.percent, 0),
            }))
          : [],
      })),
    },
  };
}

export function paymentAudienceForCategory(categoryId: number | null, config: PaymentTermsConfig): PaymentAudience {
  return categoryId != null && config.mobileCategoryIds.includes(categoryId) ? 'mobile' : 'accessory';
}

const roundedPercent = (amount: number, percent: number): number => Math.round(amount * percent / 100);

export function buildPaymentTermsQuote(
  baseAmount: number,
  audiences: PaymentAudience[],
  config: PaymentTermsConfig,
): PaymentTermsQuoteResult {
  const distinct = [...new Set(audiences)];
  if (!config.enabled) return { audience: distinct[0] ?? null, baseAmount, plans: [] };
  if (distinct.length > 1) {
    return {
      audience: 'mixed',
      baseAmount,
      plans: [],
      message: 'برای استفاده از شرایط پرداخت، کالاهای موبایل و جانبی را در دو سفارش جدا ثبت کنید.',
    };
  }
  const audience = distinct[0] ?? null;
  if (!audience) return { audience: null, baseAmount, plans: [] };

  if (audience === 'accessory') {
    if (!config.accessory.enabled) return { audience, baseAmount, plans: [] };
    const seenCash = new Set<string>();
    const plans = config.accessory.rules.filter((rule) => {
      if (!rule.enabled) return false;
      if (rule.termMonths !== 0) return true;
      const signature = `${rule.upfrontPercent}:${rule.discountPercent}`;
      if (seenCash.has(signature)) return false;
      seenCash.add(signature);
      return true;
    }).map<PaymentPlanQuote>((rule) => {
      const finalAmount = Math.max(0, baseAmount - roundedPercent(baseAmount, rule.discountPercent));
      const upfrontAmount = roundedPercent(finalAmount, rule.upfrontPercent);
      const remainingPercent = Math.max(0, 100 - rule.upfrontPercent);
      const groupLabel = rule.group === 'monthly' ? 'چک ماه‌به‌ماه' : 'چک دوماه‌به‌دوماه';
      const dueMonths: number[] = [];
      if (rule.termMonths > 0 && remainingPercent > 0) {
        const interval = rule.group === 'bimonthly' ? 2 : 1;
        for (let month = interval; month <= rule.termMonths; month += interval) dueMonths.push(month);
        if (dueMonths.length === 0 || dueMonths.at(-1) !== rule.termMonths) dueMonths.push(rule.termMonths);
      }
      const remainingAmount = finalAmount - upfrontAmount;
      const schedule = dueMonths.map((month, index) => {
        const isLast = index === dueMonths.length - 1;
        const percent = remainingPercent / dueMonths.length;
        const previousAmount = Math.round(remainingAmount / dueMonths.length) * index;
        return {
          dueLabel: `ماه ${month}`,
          percent,
          amount: isLast ? remainingAmount - previousAmount : Math.round(remainingAmount / dueMonths.length),
          optional: false,
        };
      });
      return {
        id: rule.id,
        label: rule.label,
        description: rule.termMonths === 0
          ? `پرداخت نقدی با ${rule.discountPercent}٪ تخفیف`
          : `${groupLabel}، ${rule.upfrontPercent}٪ پیش‌پرداخت${rule.discountPercent ? ` و ${rule.discountPercent}٪ تخفیف` : ''}`,
        audience,
        kind: rule.termMonths === 0 ? 'cash' : 'cheque',
        baseAmount,
        finalAmount,
        adjustmentAmount: finalAmount - baseAmount,
        discountPercent: rule.discountPercent,
        serviceFeePercent: 0,
        upfrontPercent: rule.upfrontPercent,
        upfrontAmount,
        schedule,
        instructions: config.accessory.accountInstructions,
        requiresPaymentInfo: rule.termMonths > 0,
      };
    });
    return { audience, baseAmount, plans };
  }

  if (!config.mobile.enabled) return { audience, baseAmount, plans: [] };
  const plans = config.mobile.rules.filter((rule) => rule.enabled).map<PaymentPlanQuote>((rule) => {
    const finalAmount = baseAmount + roundedPercent(baseAmount, rule.totalServicePercent);
    const schedule = rule.installments.map<PaymentScheduleItem>((item) => ({
      dueLabel: `روز ${item.day}`,
      percent: item.percent,
      amount: item.percent == null ? null : roundedPercent(finalAmount, item.percent),
      optional: item.percent == null,
    }));
    return {
      id: rule.id,
      label: rule.label,
      description: rule.days === 0
        ? 'پرداخت کامل مبلغ فاکتور'
        : `${rule.receivedLabel} دریافت اولیه، ${rule.totalServicePercent}٪ هزینه خدمات کل`,
      audience,
      kind: rule.days === 0 ? 'cash' : 'daily',
      baseAmount,
      finalAmount,
      adjustmentAmount: finalAmount - baseAmount,
      discountPercent: 0,
      serviceFeePercent: rule.totalServicePercent,
      upfrontPercent: rule.days === 0 ? 100 : null,
      upfrontAmount: rule.days === 0 ? finalAmount : null,
      schedule,
      instructions: rule.days === 0 ? config.mobile.cashAccountInstructions : config.mobile.dailyAccountInstructions,
      requiresPaymentInfo: rule.days === 0,
    };
  });
  return { audience, baseAmount, plans };
}

/** Reprice an already-snapshotted plan after an admin changes order items. */
export function repricePaymentPlan(plan: PaymentPlanQuote, baseAmount: number): PaymentPlanQuote {
  const finalAmount = baseAmount
    - roundedPercent(baseAmount, plan.discountPercent)
    + roundedPercent(baseAmount, plan.serviceFeePercent);
  const upfrontAmount = plan.upfrontPercent == null ? null : roundedPercent(finalAmount, plan.upfrontPercent);
  return {
    ...plan,
    baseAmount,
    finalAmount,
    adjustmentAmount: finalAmount - baseAmount,
    upfrontAmount,
    schedule: plan.schedule.map((item) => ({
      ...item,
      amount: item.percent == null ? null : roundedPercent(finalAmount, item.percent),
    })),
  };
}
