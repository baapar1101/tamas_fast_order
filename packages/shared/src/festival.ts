import { z } from 'zod';

/**
 * The store-wide festival (جشنواره): switched on or off by hand from the
 * admin settings, or on a schedule between two Tehran-time moments. What the
 * festival changes is chosen per effect. Stored as JSON in the `festival`
 * setting; the server works out whether it is running on every read, so a
 * scheduled festival starts and ends without any job running.
 */
export const FESTIVAL_SETTING_KEY = 'festival';
/** The older on/off switch, set by the November 2026 campaign scripts. */
export const LEGACY_CAMPAIGN_SETTING_KEY = 'campaign_mode';
export const FESTIVAL_MAX_SLIDES = 50;

export const FESTIVAL_MODES = ['off', 'on', 'scheduled'] as const;
export type FestivalMode = (typeof FESTIVAL_MODES)[number];

export const festivalEffectsSchema = z.object({
  /** The shop lists and sells only products marked «کالای جشنواره». */
  onlyFestivalProducts: z.boolean(),
  /** Checkout uses the festival column of the payment terms. */
  festivalPaymentTerms: z.boolean(),
  /** The chosen festival banners show only while the festival runs. */
  festivalBanners: z.boolean(),
  /** While the festival runs, every other banner is hidden. */
  hideOtherBanners: z.boolean(),
});
export type FestivalEffects = z.infer<typeof festivalEffectsSchema>;

export const FESTIVAL_EFFECT_LABELS: Record<keyof FestivalEffects, { label: string; hint: string }> = {
  onlyFestivalProducts: {
    label: 'فقط کالاهای جشنواره نمایش داده و فروخته شوند',
    hint: 'کالاهایی که «کالای جشنواره» نیستند در فروشگاه پنهان می‌شوند و سفارششان ثبت نمی‌شود.',
  },
  festivalPaymentTerms: {
    label: 'شرایط پرداخت جشنواره فعال شود',
    hint: 'ستون «جشنواره» در تنظیمات «شرایط پرداخت کالا» (پیش‌پرداخت و تخفیف) به‌کار می‌رود.',
  },
  festivalBanners: {
    label: 'بنرهای جشنواره فقط در زمان جشنواره نمایش داده شوند',
    hint: 'بنرهایی که پایین‌تر تیک می‌زنید، بیرون از زمان جشنواره پنهان می‌شوند.',
  },
  hideOtherBanners: {
    label: 'در زمان جشنواره بقیهٔ بنرها پنهان شوند',
    hint: 'تا جشنواره در جریان است، فقط بنرهای جشنواره در اسلایدر دیده می‌شوند.',
  },
};

const isoDateTime = z.string().datetime({ offset: true });

export const festivalConfigSchema = z.object({
  version: z.literal(1),
  mode: z.enum(FESTIVAL_MODES),
  title: z.string().trim().max(80),
  /** Used when mode is «scheduled»: the festival runs from startsAt until endsAt. */
  startsAt: isoDateTime.nullable(),
  endsAt: isoDateTime.nullable(),
  effects: festivalEffectsSchema,
  /** Banners (slide ids) that belong to the festival. */
  festivalSlideIds: z.array(z.number().int().positive()).max(FESTIVAL_MAX_SLIDES)
    .refine((ids) => new Set(ids).size === ids.length, 'یک بنر دو بار انتخاب شده است.'),
}).superRefine((config, ctx) => {
  if (config.mode !== 'scheduled') return;
  if (!config.startsAt) ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'زمان شروع جشنواره را وارد کنید.' });
  if (!config.endsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'زمان پایان جشنواره را وارد کنید.' });
  if (config.startsAt && config.endsAt && Date.parse(config.endsAt) <= Date.parse(config.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'زمان پایان باید بعد از زمان شروع باشد.' });
  }
});
export type FestivalConfig = z.infer<typeof festivalConfigSchema>;

const ALL_EFFECTS: FestivalEffects = {
  onlyFestivalProducts: true,
  festivalPaymentTerms: true,
  festivalBanners: true,
  hideOtherBanners: false,
};

export const DEFAULT_FESTIVAL_CONFIG: FestivalConfig = {
  version: 1,
  mode: 'off',
  title: 'جشنواره تماس مارکت',
  startsAt: null,
  endsAt: null,
  effects: ALL_EFFECTS,
  festivalSlideIds: [],
};

/**
 * The saved festival, or, before anything was saved from the admin panel,
 * what the older `campaign_mode` switch meant: a running festival with the
 * product and payment effects it always had.
 */
export function parseFestivalConfig(raw: string | null | undefined, legacyCampaignMode?: string | null): FestivalConfig {
  if (raw) {
    try {
      const parsed = festivalConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Fall through to the legacy switch.
    }
  }
  if (legacyCampaignMode?.startsWith('2026-11')) {
    return { ...DEFAULT_FESTIVAL_CONFIG, mode: 'on', effects: { ...ALL_EFFECTS, festivalBanners: false } };
  }
  return DEFAULT_FESTIVAL_CONFIG;
}

export type FestivalPhase = 'off' | 'on' | 'upcoming' | 'running' | 'ended';

export interface FestivalStatus {
  active: boolean;
  phase: FestivalPhase;
  startsAt: string | null;
  endsAt: string | null;
}

export function festivalStatus(config: FestivalConfig, now: Date = new Date()): FestivalStatus {
  if (config.mode === 'off') return { active: false, phase: 'off', startsAt: null, endsAt: null };
  if (config.mode === 'on') return { active: true, phase: 'on', startsAt: null, endsAt: null };
  const start = config.startsAt ? Date.parse(config.startsAt) : NaN;
  const end = config.endsAt ? Date.parse(config.endsAt) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { active: false, phase: 'off', startsAt: config.startsAt, endsAt: config.endsAt };
  const t = now.getTime();
  const phase: FestivalPhase = t < start ? 'upcoming' : t < end ? 'running' : 'ended';
  return { active: phase === 'running', phase, startsAt: config.startsAt, endsAt: config.endsAt };
}

/** What the festival changes right now; every effect is off while it is not running. */
export interface FestivalState extends FestivalStatus {
  onlyFestivalProducts: boolean;
  festivalPaymentTerms: boolean;
  /** Slides to leave out of the storefront slider at this moment. */
  hiddenSlideIds: number[];
  /** When set, only these slides show (festival running with «hide other banners»). */
  onlySlideIds: number[] | null;
}

export function festivalState(config: FestivalConfig, now: Date = new Date()): FestivalState {
  const status = festivalStatus(config, now);
  const { effects } = config;
  return {
    ...status,
    onlyFestivalProducts: status.active && effects.onlyFestivalProducts,
    festivalPaymentTerms: status.active && effects.festivalPaymentTerms,
    hiddenSlideIds: !status.active && effects.festivalBanners ? config.festivalSlideIds : [],
    onlySlideIds: status.active && effects.hideOtherBanners && config.festivalSlideIds.length > 0 ? config.festivalSlideIds : null,
  };
}

/** The slides a shopper sees, given the festival's state. */
export function festivalSlides<T extends { id: number }>(slides: T[], state: Pick<FestivalState, 'hiddenSlideIds' | 'onlySlideIds'>): T[] {
  const hidden = new Set(state.hiddenSlideIds);
  const only = state.onlySlideIds ? new Set(state.onlySlideIds) : null;
  return slides.filter((slide) => !hidden.has(slide.id) && (!only || only.has(slide.id)));
}

/* ------------------------------------------------------------------ *
 * Tehran-time Jalali dates for the schedule inputs
 * ------------------------------------------------------------------ */

/** Iran has kept a fixed UTC+03:30 offset since daylight saving ended in 2022. */
const TEHRAN_OFFSET = '+03:30';

function tehranJalaliParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value('year'), month: value('month'), day: value('day') };
}

/**
 * Jalali (Solar Hijri) date to Gregorian, or null when the day does not exist
 * (for example Esfand 30 in a common year). Estimates from 1 Farvardin ≈ 21
 * March and settles the exact day with the platform's Persian calendar.
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } | null {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd) || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const dayOfYear = (jm <= 6 ? (jm - 1) * 31 : 186 + (jm - 7) * 30) + jd - 1;
  const estimate = Date.UTC(jy + 621, 2, 21, 9) + dayOfYear * 86_400_000;
  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    const candidate = new Date(estimate + offset * 86_400_000);
    const parts = tehranJalaliParts(candidate);
    if (parts.year === jy && parts.month === jm && parts.day === jd) {
      return { gy: candidate.getUTCFullYear(), gm: candidate.getUTCMonth() + 1, gd: candidate.getUTCDate() };
    }
  }
  return null;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * «1405/08/24» and «18:30» in Tehran time to an ISO string, or null when the
 * date or time is not valid. Persian digits are accepted.
 */
export function tehranJalaliToIso(date: string, time: string): string | null {
  const ascii = (value: string) => value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const dateMatch = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(ascii(date.trim()));
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(ascii(time.trim()));
  if (!dateMatch || !timeMatch) return null;
  const [jy, jm, jd] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [hh, mm] = [Number(timeMatch[1]), Number(timeMatch[2])];
  if (hh > 23 || mm > 59) return null;
  const gregorian = jalaliToGregorian(jy, jm, jd);
  if (!gregorian) return null;
  return `${gregorian.gy}-${pad2(gregorian.gm)}-${pad2(gregorian.gd)}T${pad2(hh)}:${pad2(mm)}:00${TEHRAN_OFFSET}`;
}

/** An ISO moment as a Tehran-time Jalali date («1405/08/24») and time («18:30»). */
export function isoToTehranJalali(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  return { date: `${part('year')}/${part('month')}/${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}
