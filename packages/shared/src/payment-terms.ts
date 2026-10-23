export const PAYMENT_TERMS_SETTING_KEY = 'PAYMENT_TERMS_CONFIG';

export type PaymentAudience = 'accessory' | 'mobile';
export type PaymentPlanKind = 'cash' | 'cheque' | 'daily';
export type ProductSettlementPolicy = 'cash_only' | 'cheque_2' | 'unrestricted';

export interface AccessoryPaymentRule {
  id: string;
  label: string;
  enabled: boolean;
  group: 'monthly' | 'bimonthly';
  termMonths: number;
  upfrontPercent: number;
  discountPercent: number;
  installmentProfitPercent: number;
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
    weeklyCreditLimit: number;
    /** Cash discount for every category that is not configured as mobile. */
    cashDiscountPercent: number;
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
  dueDate: string | null;
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
  /** Checkout selector metadata for accessory cheque plans. */
  termMonths: number | null;
  installmentIntervalMonths: number | null;
  /** Checkout selector metadata for mobile settlement plans. */
  settlementDays: number | null;
  /** Pricing snapshots used when one invoice combines products with different settlement policies. */
  components?: PaymentPlanQuote[];
}

export interface PaymentTermsQuoteResult {
  audience: PaymentAudience | 'mixed' | null;
  baseAmount: number;
  plans: PaymentPlanQuote[];
  message?: string;
  /** When true, checkout must use one of these plans and may not bypass it with another payment method. */
  enforcedSettlement?: boolean;
  settlementPolicy?: ProductSettlementPolicy | 'combined';
}

export interface PaymentTermsLineQuote {
  amount: number;
  audience: PaymentAudience;
  sellType: string | null | undefined;
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
      installmentProfitPercent: 0,
    };
  });
};

export const DEFAULT_PAYMENT_TERMS_CONFIG: PaymentTermsConfig = {
  version: 1,
  enabled: true,
  mobileCategoryIds: [2],
  accessory: {
    enabled: true,
    weeklyCreditLimit: 300_000_000,
    cashDiscountPercent: 10,
    accountInstructions: 'بانک ملت - به نام حمید قاسم زاده\nشماره کارت: 6104-3311-4877-4871\nشماره شبا: IR980120010000007697585463',
    rules: [
      ...accessoryRules('monthly', [100, 0, 0, 20, 30, 35, 40], [10, 5, 3, 0, 0, 0, 0]),
      ...accessoryRules('bimonthly', [100, 0, 20, 0, 35, 0, 50], [10, 5, 0, 0, 0, 0, 0]),
    ],
  },
  mobile: {
    enabled: true,
    cashAccountInstructions: 'بانک ملت - به نام حمید قاسم زاده\nشماره کارت: 6104-3311-4877-4871\nشماره شبا: IR980120010000007697585463',
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
      weeklyCreditLimit: numberInRange(accessory.weeklyCreditLimit, defaults.accessory.weeklyCreditLimit, 0, 10_000_000_000),
      cashDiscountPercent: numberInRange(accessory.cashDiscountPercent, defaults.accessory.cashDiscountPercent),
      rules: parsedAccessoryRules.map((rule, index) => ({
        id: text(rule?.id, `accessory-rule-${index}`),
        label: text(rule?.label, `شرایط پرداخت ${index + 1}`),
        enabled: rule?.enabled !== false,
        group: rule?.group === 'bimonthly' ? 'bimonthly' : 'monthly',
        termMonths: Math.round(numberInRange(rule?.termMonths, 0, 0, 36)),
        upfrontPercent: numberInRange(rule?.upfrontPercent, 0),
        discountPercent: numberInRange(rule?.discountPercent, 0),
        installmentProfitPercent: numberInRange(rule?.installmentProfitPercent, 0),
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

const normalizeSettlementText = (value: string): string => value
  .toLowerCase()
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/ي/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/\s+/g, ' ')
  .trim();

/** Convert the legacy free-text product sell type into an enforceable settlement policy. */
export function settlementPolicyFromSellType(sellType: string | null | undefined): ProductSettlementPolicy {
  const value = normalizeSettlementText(sellType ?? '');
  if (!value) return 'unrestricted';
  const hasCash = /نقد|cash/.test(value);
  const hasCredit = /چک|اعتبار|credit/.test(value);
  const isTwoMonth = hasCredit && /(?:^|\D)(?:2|دو)\s*ماه/.test(value);
  if (isTwoMonth && !/بدون\s*محدودیت|(?:6|شش)\s*ماه/.test(value)) return 'cheque_2';
  if (hasCash && !hasCredit) return 'cash_only';
  return 'unrestricted';
}

const roundedPercent = (amount: number, percent: number): number => Math.round(amount * percent / 100);
const roundedChequeAmount = (amount: number): number => Math.max(0, Math.round(amount / 10_000) * 10_000);

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
      const signature = `${rule.upfrontPercent}:${config.accessory.cashDiscountPercent}`;
      if (seenCash.has(signature)) return false;
      seenCash.add(signature);
      return true;
    }).map<PaymentPlanQuote>((rule) => {
      const isCash = rule.termMonths === 0;
      const discountPercent = isCash ? config.accessory.cashDiscountPercent : rule.discountPercent;
      const serviceFeePercent = isCash ? 0 : rule.installmentProfitPercent;
      const calculatedFinalAmount = Math.max(
        0,
        baseAmount - roundedPercent(baseAmount, discountPercent) + roundedPercent(baseAmount, serviceFeePercent),
      );
      const finalAmount = rule.termMonths > 0 ? roundedChequeAmount(calculatedFinalAmount) : calculatedFinalAmount;
      const upfrontAmount = rule.termMonths > 0
        ? roundedChequeAmount(roundedPercent(finalAmount, rule.upfrontPercent))
        : roundedPercent(finalAmount, rule.upfrontPercent);
      const remainingPercent = Math.max(0, 100 - rule.upfrontPercent);
      const groupLabel = rule.group === 'monthly' ? 'چک ماه‌به‌ماه' : 'چک دوماه‌به‌دوماه';
      const dueMonths: number[] = [];
      if (rule.termMonths > 0 && remainingPercent > 0) {
        const interval = rule.group === 'bimonthly' ? 2 : 1;
        for (let month = interval; month <= rule.termMonths; month += interval) dueMonths.push(month);
        if (dueMonths.length === 0 || dueMonths.at(-1) !== rule.termMonths) dueMonths.push(rule.termMonths);
      }
      const remainingAmount = finalAmount - upfrontAmount;
      const regularAmount = dueMonths.length ? roundedChequeAmount(remainingAmount / dueMonths.length) : 0;
      const schedule = dueMonths.map((month, index) => {
        const isLast = index === dueMonths.length - 1;
        const percent = remainingPercent / dueMonths.length;
        const previousAmount = regularAmount * index;
        return {
          dueLabel: `ماه ${month}`,
          dueDate: null,
          percent,
          amount: isLast ? Math.max(0, remainingAmount - previousAmount) : regularAmount,
          optional: false,
        };
      });
      return {
        id: rule.id,
        label: rule.label,
        description: isCash
          ? `پرداخت نقدی با ${discountPercent}٪ تخفیف`
          : `${groupLabel}، پیش‌پرداخت ${upfrontAmount.toLocaleString('fa-IR')} تومان${discountPercent ? `، ${discountPercent}٪ تخفیف شرایط` : ''}${serviceFeePercent ? `، ${serviceFeePercent}٪ سود اقساط` : ''}`,
        audience,
        kind: isCash ? 'cash' : 'cheque',
        baseAmount,
        finalAmount,
        adjustmentAmount: finalAmount - baseAmount,
        discountPercent,
        serviceFeePercent,
        upfrontPercent: rule.upfrontPercent,
        upfrontAmount,
        schedule,
        instructions: config.accessory.accountInstructions,
        requiresPaymentInfo: rule.termMonths > 0,
        termMonths: rule.termMonths,
        installmentIntervalMonths: rule.termMonths > 0 ? (rule.group === 'bimonthly' ? 2 : 1) : null,
        settlementDays: null,
      };
    });
    return { audience, baseAmount, plans };
  }

  if (!config.mobile.enabled) return { audience, baseAmount, plans: [] };
  const plans = config.mobile.rules.filter((rule) => rule.enabled).map<PaymentPlanQuote>((rule) => {
    const finalAmount = baseAmount + roundedPercent(baseAmount, rule.totalServicePercent);
    const schedule = rule.installments.map<PaymentScheduleItem>((item) => ({
      dueLabel: `روز ${item.day}`,
      dueDate: null,
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
      termMonths: null,
      installmentIntervalMonths: null,
      settlementDays: rule.days,
    };
  });
  return { audience, baseAmount, plans };
}

const chequeMonth = (item: PaymentScheduleItem, index: number, plan: PaymentPlanQuote): number => {
  const parsed = Number(item.dueLabel.match(/\d+/)?.[0]);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return Math.min(plan.termMonths ?? index + 1, (index + 1) * (plan.installmentIntervalMonths ?? 1));
};

function mergeChequeSchedules(components: PaymentPlanQuote[], finalAmount: number): PaymentScheduleItem[] {
  const byMonth = new Map<number, number>();
  for (const component of components) {
    component.schedule.forEach((item, index) => {
      if (item.amount == null || item.amount <= 0) return;
      const month = chequeMonth(item, index, component);
      byMonth.set(month, (byMonth.get(month) ?? 0) + item.amount);
    });
  }
  return [...byMonth.entries()].sort(([a], [b]) => a - b).map(([month, amount]) => ({
    dueLabel: `ماه ${month}`,
    dueDate: null,
    percent: finalAmount > 0 ? amount * 100 / finalAmount : 0,
    amount,
    optional: false,
  }));
}

function compositeAccessoryPlan(baseAmount: number, components: PaymentPlanQuote[], instructions: string): PaymentPlanQuote {
  const finalAmount = components.reduce((sum, plan) => sum + plan.finalAmount, 0);
  const upfrontAmount = components.reduce((sum, plan) => sum + (plan.kind === 'cash' ? plan.finalAmount : plan.upfrontAmount ?? 0), 0);
  const termMonths = Math.max(0, ...components.map((plan) => plan.termMonths ?? 0));
  const schedule = mergeChequeSchedules(components, finalAmount);
  const savings = Math.max(0, baseAmount - finalAmount);
  return {
    id: 'accessory-combined-required',
    label: 'تسویه ترکیبی طبق شرایط کالاها',
    description: `پرداخت نقدی و پیش‌پرداخت ${upfrontAmount.toLocaleString('fa-IR')} تومان، سپس ${schedule.length.toLocaleString('fa-IR')} فقره چک تجمیع‌شده${savings > 0 ? `؛ سود شما ${savings.toLocaleString('fa-IR')} تومان` : ''}`,
    audience: 'accessory',
    kind: 'cheque',
    baseAmount,
    finalAmount,
    adjustmentAmount: finalAmount - baseAmount,
    discountPercent: baseAmount > 0 ? savings * 100 / baseAmount : 0,
    serviceFeePercent: 0,
    upfrontPercent: finalAmount > 0 ? upfrontAmount * 100 / finalAmount : 0,
    upfrontAmount,
    schedule,
    instructions,
    requiresPaymentInfo: true,
    termMonths,
    installmentIntervalMonths: 2,
    settlementDays: null,
    components,
  };
}

/** Quote payment terms while enforcing each product's settlement restriction. */
export function buildRestrictedPaymentTermsQuote(
  lines: PaymentTermsLineQuote[],
  config: PaymentTermsConfig,
): PaymentTermsQuoteResult {
  const baseAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const audiences = lines.map((line) => line.audience);
  const regular = buildPaymentTermsQuote(baseAmount, audiences, config);
  if (regular.audience === 'mixed' || regular.audience == null || !config.enabled) return regular;

  const policies = lines.map((line) => settlementPolicyFromSellType(line.sellType));
  if (policies.every((policy) => policy === 'unrestricted')) return regular;

  if (regular.audience === 'mobile') {
    if (!policies.some((policy) => policy === 'cash_only')) return regular;
    return {
      ...regular,
      plans: regular.plans.filter((plan) => plan.kind === 'cash'),
      enforcedSettlement: true,
      settlementPolicy: 'cash_only',
      message: 'به‌دلیل وجود کالای فقط نقدی، تسویه این فاکتور فقط به‌صورت نقدی امکان‌پذیر است.',
    };
  }

  if (policies.every((policy) => policy === 'cash_only')) {
    return {
      ...regular,
      plans: regular.plans.filter((plan) => plan.kind === 'cash'),
      enforcedSettlement: true,
      settlementPolicy: 'cash_only',
      message: 'تمام کالاهای این فاکتور فقط به‌صورت نقدی تسویه می‌شوند.',
    };
  }

  const chooseCheque = (plans: PaymentPlanQuote[], months: number) => plans
    .filter((plan) => plan.kind === 'cheque' && plan.termMonths === months)
    .sort((a, b) => (b.installmentIntervalMonths ?? 0) - (a.installmentIntervalMonths ?? 0))[0] ?? null;

  if (policies.every((policy) => policy === 'cheque_2')) {
    const plan = chooseCheque(regular.plans, 2);
    return {
      ...regular,
      plans: plan ? [plan] : [],
      enforcedSettlement: true,
      settlementPolicy: 'cheque_2',
      message: plan ? 'تسویه این فاکتور طبق محدودیت کالا فقط با برنامه چک دوماهه انجام می‌شود.' : 'برنامه چک دوماهه در تنظیمات پرداخت فعال نیست.',
    };
  }

  const amountByPolicy = new Map<ProductSettlementPolicy, number>();
  lines.forEach((line, index) => amountByPolicy.set(policies[index]!, (amountByPolicy.get(policies[index]!) ?? 0) + line.amount));
  const components: PaymentPlanQuote[] = [];
  for (const [policy, amount] of amountByPolicy) {
    const quote = buildPaymentTermsQuote(amount, ['accessory'], config);
    const selected = policy === 'cash_only'
      ? quote.plans.find((plan) => plan.kind === 'cash') ?? null
      : chooseCheque(quote.plans, policy === 'cheque_2' ? 2 : 6);
    if (!selected) {
      return {
        audience: 'accessory',
        baseAmount,
        plans: [],
        enforcedSettlement: true,
        settlementPolicy: 'combined',
        message: policy === 'cash_only' ? 'برنامه پرداخت نقدی فعال نیست.' : `برنامه چک ${policy === 'cheque_2' ? 'دو' : 'شش'}ماهه فعال نیست.`,
      };
    }
    components.push(selected);
  }
  return {
    audience: 'accessory',
    baseAmount,
    plans: [compositeAccessoryPlan(baseAmount, components, config.accessory.accountInstructions)],
    enforcedSettlement: true,
    settlementPolicy: 'combined',
    message: 'شرایط تسویه کالاها ترکیب شد؛ مبالغ هم‌سررسید در یک چک واحد تجمیع شده‌اند.',
  };
}

/** Reprice an already-snapshotted plan after an admin changes order items. */
export function repricePaymentPlan(plan: PaymentPlanQuote, baseAmount: number): PaymentPlanQuote {
  if (plan.components?.length) {
    let allocated = 0;
    const components = plan.components.map((component, index) => {
      const componentBase = index === plan.components!.length - 1
        ? Math.max(0, baseAmount - allocated)
        : Math.max(0, Math.round(baseAmount * component.baseAmount / Math.max(1, plan.baseAmount)));
      allocated += componentBase;
      return repricePaymentPlan(component, componentBase);
    });
    const repriced = compositeAccessoryPlan(baseAmount, components, plan.instructions);
    return { ...repriced, id: plan.id, label: plan.label };
  }
  const calculatedFinalAmount = baseAmount
    - roundedPercent(baseAmount, plan.discountPercent)
    + roundedPercent(baseAmount, plan.serviceFeePercent);
  const finalAmount = plan.kind === 'cheque' ? roundedChequeAmount(calculatedFinalAmount) : calculatedFinalAmount;
  const upfrontAmount = plan.upfrontPercent == null
    ? null
    : plan.kind === 'cheque'
      ? roundedChequeAmount(roundedPercent(finalAmount, plan.upfrontPercent))
      : roundedPercent(finalAmount, plan.upfrontPercent);
  const payableBySchedule = Math.max(0, finalAmount - (upfrontAmount ?? 0));
  const payableItems = plan.schedule.filter((item) => item.percent != null);
  const regularAmount = payableItems.length ? roundedChequeAmount(payableBySchedule / payableItems.length) : 0;
  let pricedItems = 0;
  return {
    ...plan,
    baseAmount,
    finalAmount,
    adjustmentAmount: finalAmount - baseAmount,
    upfrontAmount,
    schedule: plan.schedule.map((item) => ({
      ...item,
      amount: item.percent == null ? null : plan.kind === 'cheque'
        ? (++pricedItems === payableItems.length
            ? Math.max(0, payableBySchedule - regularAmount * (payableItems.length - 1))
            : regularAmount)
        : roundedPercent(finalAmount, item.percent),
    })),
  };
}
