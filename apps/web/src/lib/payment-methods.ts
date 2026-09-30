import type { PaymentMethodConfig } from '@tamas/shared';

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'aqayepardakht',
    label: 'پرداخت آنلاین (درگاه بانکی)',
    desc: 'تسویه از طریق درگاه امن بانکی و تایید آنی سفارش',
    enabled: true,
    type: 'online',
    sortOrder: 1,
  },
  {
    id: 'online',
    label: 'کارت به کارت / واریز به حساب',
    desc: 'تسویه به صورت دستی و ثبت فیش در واتساپ',
    enabled: true,
    type: 'manual',
    instructions: 'مبلغ سفارش را به شماره کارت زیر واریز کنید:\n💳 بانک ملت — به نام حمید قاسم زاده\n💳 شماره کارت: 6104-3311-4877-4871\n💳 شماره شبا: IR980120010000007697585463',
    sortOrder: 2,
  },
  {
    id: 'credit_weekly',
    label: 'اعتباری هفتگی',
    desc: 'تسویه پنجشنبه‌ها (نیاز به تأیید واحد مالی)',
    enabled: true,
    type: 'credit',
    sortOrder: 3,
  },
  {
    id: 'check_2_month',
    label: 'چکی دو ماهه',
    desc: 'با ارائه چک صیادی و ثبت قرارداد',
    enabled: true,
    type: 'cheque',
    sortOrder: 4,
  },
  {
    id: 'check_4_month',
    label: 'چکی چهار ماهه',
    desc: 'مخصوص سفارشات عمده (با تأیید مالی)',
    enabled: true,
    type: 'cheque',
    sortOrder: 5,
  },
];

export function parsePaymentMethods(jsonStr: string | undefined): PaymentMethodConfig[] {
  if (!jsonStr) return DEFAULT_PAYMENT_METHODS;
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PAYMENT_METHODS;
    return parsed.map((m, idx) => ({
      id: String(m.id || `pm_${idx}`),
      label: String(m.label || 'روش پرداخت'),
      desc: String(m.desc || ''),
      enabled: m.enabled !== false,
      type: m.type || 'custom',
      instructions: m.instructions ? String(m.instructions) : undefined,
      minAmount: m.minAmount ? Number(m.minAmount) : undefined,
      maxAmount: m.maxAmount ? Number(m.maxAmount) : undefined,
      sortOrder: m.sortOrder ?? idx + 1,
    }));
  } catch {
    return DEFAULT_PAYMENT_METHODS;
  }
}
