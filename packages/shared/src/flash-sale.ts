import { z } from 'zod';
import type { ProductDTO } from './types.js';

/**
 * The daily timed sale («۴ ساعت فروش با پَ مَ سود»): selected products sell at
 * a floor price between two Tehran-time hours every day. Stored as JSON in
 * the `flash_sale` setting and edited from the admin panel. The server is the
 * only place that applies the price (catalog and checkout), so a stale page
 * can never buy at the sale price outside the window.
 */
export const FLASH_SALE_SETTING_KEY = 'flash_sale';
/** The deepest discount the sale may give, in percent of the regular price. */
export const FLASH_SALE_MAX_DISCOUNT = 50;
export const FLASH_SALE_MAX_ITEMS = 24;
/** Iran has kept a fixed UTC+03:30 offset since daylight saving ended in 2022. */
const TEHRAN_OFFSET_MINUTES = 210;
const DAY_MS = 86_400_000;

export const flashSaleItemSchema = z.object({
  productId: z.string().trim().min(1).max(40),
  /** Sale price in toman, the same unit as product prices. */
  salePrice: z.number().int().positive(),
});
export type FlashSaleItem = z.infer<typeof flashSaleItemSchema>;

export const flashSaleConfigSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  title: z.string().trim().min(1, 'عنوان فروش ویژه را بنویسید.').max(80),
  subtitle: z.string().trim().max(200),
  /** Tehran-time hours: the sale runs from startHour:00 until endHour:00. */
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  items: z.array(flashSaleItemSchema).max(FLASH_SALE_MAX_ITEMS, `حداکثر ${FLASH_SALE_MAX_ITEMS} کالا`)
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, 'یک کالا دو بار در فهرست آمده است.'),
}).refine((config) => config.endHour > config.startHour, { message: 'ساعت پایان باید بعد از ساعت شروع باشد.', path: ['endHour'] });
export type FlashSaleConfig = z.infer<typeof flashSaleConfigSchema>;

export const DEFAULT_FLASH_SALE_CONFIG: FlashSaleConfig = {
  version: 1,
  enabled: false,
  title: '۴ ساعت فروش با پَ مَ سود',
  subtitle: 'هر روز از ساعت ۱۸ تا ۲۲؛ کالاهای منتخب با کف قیمت و تا ۵۰٪ تخفیف',
  startHour: 18,
  endHour: 22,
  items: [],
};

export function parseFlashSaleConfig(raw: string | null | undefined): FlashSaleConfig {
  if (!raw) return DEFAULT_FLASH_SALE_CONFIG;
  try {
    const parsed = flashSaleConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_FLASH_SALE_CONFIG;
  } catch {
    return DEFAULT_FLASH_SALE_CONFIG;
  }
}

export interface FlashSaleWindow {
  active: boolean;
  /** Start of the current window, or of the next one when not active. */
  startsAt: Date;
  endsAt: Date;
}

/** Today's (or, after it ends, tomorrow's) sale window in Tehran time. */
export function flashSaleWindow(config: Pick<FlashSaleConfig, 'startHour' | 'endHour'>, now: Date = new Date()): FlashSaleWindow {
  const offset = TEHRAN_OFFSET_MINUTES * 60_000;
  const tehranMidnight = Math.floor((now.getTime() + offset) / DAY_MS) * DAY_MS - offset;
  let start = tehranMidnight + config.startHour * 3_600_000;
  let end = tehranMidnight + config.endHour * 3_600_000;
  if (now.getTime() >= end) {
    start += DAY_MS;
    end += DAY_MS;
  }
  return { active: now.getTime() >= start && now.getTime() < end, startsAt: new Date(start), endsAt: new Date(end) };
}

/** The lowest price the sale may set for a product with this regular price. */
export function flashSaleFloor(regularPrice: number): number {
  return Math.ceil(regularPrice * (100 - FLASH_SALE_MAX_DISCOUNT) / 100);
}

/**
 * The sale price of one product right now, or null when it is not on sale:
 * the sale is off or outside its hours, the product is not listed, or the
 * listed price would not be a discount. A regular price lowered after the
 * item was listed never lets the discount pass the 50% cap.
 */
export function flashSalePrice(config: FlashSaleConfig, productId: string, regularPrice: number, now: Date = new Date()): number | null {
  if (!config.enabled || regularPrice <= 0) return null;
  const item = config.items.find((entry) => entry.productId === productId);
  if (!item || !flashSaleWindow(config, now).active) return null;
  const price = Math.max(item.salePrice, flashSaleFloor(regularPrice));
  return price < regularPrice ? price : null;
}

export function discountPercent(regularPrice: number, salePrice: number): number {
  if (regularPrice <= 0 || salePrice >= regularPrice) return 0;
  return Math.round((1 - salePrice / regularPrice) * 100);
}

/** What the storefront's sale section receives from `GET /catalog/flash-sale`. */
export interface FlashSaleShowcase {
  title: string;
  subtitle: string;
  startHour: number;
  endHour: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
  serverTime: string;
  items: Array<{ product: ProductDTO; regularPrice: number; salePrice: number; percent: number }>;
}
