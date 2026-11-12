import { z } from 'zod';

/**
 * Home page landing: which sections show, in what order, and their copy.
 * Stored as JSON in the `landing_page` setting and edited from the admin
 * panel. Product, banner, category and brand content always comes from the
 * live catalog; only wording and choices live here.
 */

export const LANDING_SETTING_KEY = 'landing_page';

const text = (max: number) => z.string().trim().max(max);
const id = z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/i);

export const LANDING_BENEFIT_ICONS = ['warehouse', 'price', 'credit', 'speed', 'support', 'shield', 'truck', 'sparkles'] as const;
export type LandingBenefitIcon = (typeof LANDING_BENEFIT_ICONS)[number];

export const LANDING_FEATURED_SOURCES = ['promotion', 'newest', 'category', 'brand'] as const;
export type LandingFeaturedSource = (typeof LANDING_FEATURED_SOURCES)[number];

const heroSchema = z.object({
  badge: text(60),
  titleBefore: text(60),
  rotatingWords: z.array(text(30).min(1)).max(6),
  titleAfter: text(80),
  subtitle: text(260),
  primaryLabel: text(40).min(1),
  secondaryLabel: text(40).min(1),
  showSlides: z.boolean(),
});

const base = { id, enabled: z.boolean() };

const wholesaleSection = z.object({
  ...base,
  type: z.literal('wholesale'),
  title: text(80),
  text: text(300),
  buttonLabel: text(40).min(1),
  points: z.array(text(80).min(1)).max(6),
});

const featuredSection = z.object({
  ...base,
  type: z.literal('featured'),
  title: text(80),
  subtitle: text(200),
  source: z.enum(LANDING_FEATURED_SOURCES),
  /** Category or brand name (English key) when the source needs one. */
  value: text(160),
  limit: z.number().int().min(4).max(12),
});

const bannersSection = z.object({
  ...base,
  type: z.literal('banners'),
  title: text(80),
  subtitle: text(200),
});

const categoriesSection = z.object({
  ...base,
  type: z.literal('categories'),
  title: text(80),
  subtitle: text(200),
  limit: z.number().int().min(3).max(12),
});

const brandsSection = z.object({
  ...base,
  type: z.literal('brands'),
  title: text(80),
});

const benefitsSection = z.object({
  ...base,
  type: z.literal('benefits'),
  title: text(80),
  subtitle: text(200),
  items: z.array(z.object({ icon: z.enum(LANDING_BENEFIT_ICONS), title: text(60).min(1), text: text(200) })).max(6),
});

const stepsSection = z.object({
  ...base,
  type: z.literal('steps'),
  title: text(80),
  items: z.array(z.object({ title: text(60).min(1), text: text(200) })).max(5),
});

const ctaSection = z.object({
  ...base,
  type: z.literal('cta'),
  title: text(100),
  text: text(260),
  buttonLabel: text(40).min(1),
});

export const landingSectionSchema = z.discriminatedUnion('type', [
  wholesaleSection,
  featuredSection,
  bannersSection,
  categoriesSection,
  brandsSection,
  benefitsSection,
  stepsSection,
  ctaSection,
]);
export type LandingSection = z.infer<typeof landingSectionSchema>;
export type LandingSectionType = LandingSection['type'];

export const landingConfigSchema = z.object({
  version: z.literal(1),
  /** Off: the home address opens the catalog directly, as before. */
  enabled: z.boolean(),
  /** Approved partners skip the landing and open the catalog. */
  partnersSkipLanding: z.boolean(),
  hero: heroSchema,
  sections: z.array(landingSectionSchema).max(16)
    .refine((sections) => new Set(sections.map((section) => section.id)).size === sections.length, 'شناسهٔ بخش‌ها تکراری است.'),
});
export type LandingConfig = z.infer<typeof landingConfigSchema>;

export const LANDING_SECTION_LABELS: Record<LandingSectionType, string> = {
  wholesale: 'ورود به خرید عمده',
  featured: 'محصولات ویژه',
  banners: 'بنرها',
  categories: 'دسته‌بندی‌ها',
  brands: 'برندها',
  benefits: 'مزیت‌ها',
  steps: 'مراحل سفارش',
  cta: 'دعوت پایانی',
};

/** A new section of each type, with copy the admin can then edit. */
export function newLandingSection(type: LandingSectionType, sectionId: string): LandingSection {
  const common = { id: sectionId, enabled: true };
  switch (type) {
    case 'wholesale':
      return {
        ...common,
        type,
        title: 'ورود به بخش خرید عمده',
        text: 'همهٔ کالاها با موجودی واقعی انبارهای کرمان و تهران؛ جست‌وجو کنید، فیلتر بزنید و سفارش عمده را در چند دقیقه ثبت کنید.',
        buttonLabel: 'ورود به فروشگاه عمده',
        points: ['موجودی لحظه‌ای دو انبار', 'حالت خرید سریع برای سفارش‌های بزرگ', 'قیمت همکاری پس از تأیید حساب'],
      };
    case 'featured':
      return { ...common, type, title: 'محصولات ویژه', subtitle: 'پیشنهادهای منتخب این هفته', source: 'promotion', value: '', limit: 8 };
    case 'banners':
      return { ...common, type, title: 'کمپین‌ها و پیشنهادها', subtitle: '' };
    case 'categories':
      return { ...common, type, title: 'خرید بر اساس دسته‌بندی', subtitle: 'هر دسته را باز کنید و مستقیم به کالاهایش بروید.', limit: 6 };
    case 'brands':
      return { ...common, type, title: 'برندهایی که تأمین می‌کنیم' };
    case 'benefits':
      return {
        ...common,
        type,
        title: 'چرا همکاران تماس مارکت را انتخاب می‌کنند',
        subtitle: '',
        items: [
          { icon: 'warehouse', title: 'موجودی واقعی دو انبار', text: 'موجودی کرمان و تهران را همان لحظه ببینید و از انبار مناسب سفارش دهید.' },
          { icon: 'price', title: 'قیمت ویژهٔ همکاری', text: 'پس از تأیید حساب همکاری، قیمت‌های عمده برایتان نمایش داده می‌شود.' },
          { icon: 'credit', title: 'خرید اعتباری و چکی', text: 'همکاران تأییدشده می‌توانند پس از بررسی پرونده، با اعتبار هفتگی یا چک خرید کنند.' },
          { icon: 'speed', title: 'سفارش سریع', text: 'با حالت «خرید سریع» ده‌ها کالا را در چند دقیقه به سبد اضافه کنید.' },
        ],
      };
    case 'steps':
      return {
        ...common,
        type,
        title: 'سفارش عمده در سه قدم',
        items: [
          { title: 'ثبت‌نام همکار', text: 'با شمارهٔ همراه وارد شوید و اطلاعات فروشگاه را کامل کنید تا حساب همکاری تأیید شود.' },
          { title: 'انتخاب کالا و انبار', text: 'کالاها را جست‌وجو و فیلتر کنید، تنوع و انبار را انتخاب کنید و به سبد بیفزایید.' },
          { title: 'ثبت و پرداخت', text: 'سفارش را با پرداخت آنلاین، کارت‌به‌کارت یا روش اعتباری فعال برای حسابتان ثبت کنید.' },
        ],
      };
    case 'cta':
      return {
        ...common,
        type,
        title: 'آماده‌اید موجودی فروشگاهتان را تأمین کنید؟',
        text: 'همین حالا وارد بخش خرید عمده شوید و کالاهای موردنیاز را با موجودی واقعی انتخاب کنید.',
        buttonLabel: 'شروع خرید عمده',
      };
  }
}

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  version: 1,
  enabled: true,
  partnersSkipLanding: true,
  hero: {
    badge: 'ویژهٔ همکاران و فروشگاه‌داران',
    titleBefore: 'تأمین هوشمند',
    rotatingWords: ['گوشی موبایل', 'لوازم جانبی', 'کالای دیجیتال'],
    titleAfter: 'به سرعت کسب‌وکار شما',
    subtitle: 'کالای موردنیاز فروشگاهت را پیدا کن، تنوع و موجودی را بررسی کن و سفارش عمده را در چند مرحله ثبت کن.',
    primaryLabel: 'ورود به خرید عمده',
    secondaryLabel: 'ورود / ثبت‌نام همکار',
    showSlides: true,
  },
  sections: [
    newLandingSection('wholesale', 'wholesale'),
    newLandingSection('featured', 'featured'),
    newLandingSection('categories', 'categories'),
    newLandingSection('banners', 'banners'),
    newLandingSection('benefits', 'benefits'),
    newLandingSection('brands', 'brands'),
    newLandingSection('steps', 'steps'),
    newLandingSection('cta', 'cta'),
  ],
};

/** Saved landing settings, or the defaults when nothing valid is stored. */
export function parseLandingConfig(raw: string | null | undefined): LandingConfig {
  if (!raw) return DEFAULT_LANDING_CONFIG;
  try {
    const parsed = landingConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LANDING_CONFIG;
  } catch {
    return DEFAULT_LANDING_CONFIG;
  }
}
