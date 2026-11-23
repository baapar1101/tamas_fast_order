import { z } from 'zod';

/**
 * Public price lists (for example «لیست قیمت موبایل» and «لیست قیمت
 * محصولات اورجینال»): each list is a set of categories and, optionally,
 * brands. Rows come straight from the site's current prices, so a list is up
 * to date the moment prices change (Excel update, panel edit). Stored as JSON
 * in the `price_lists` setting.
 */
export const PRICE_LISTS_SETTING_KEY = 'price_lists';
export const PRICE_LISTS_MAX = 8;

export const priceListDefinitionSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{1,40}$/, 'شناسهٔ لیست فقط حروف کوچک انگلیسی، عدد و خط تیره است.'),
  title: z.string().trim().min(1, 'عنوان لیست را بنویسید.').max(80),
  /** Category names (English or Persian, as in the panel). */
  categoryNames: z.array(z.string().trim().min(1).max(160)).max(40),
  /** Optional: only these brands. Empty means every brand. */
  brandNames: z.array(z.string().trim().min(1).max(160)).max(80),
  inStockOnly: z.boolean(),
  enabled: z.boolean(),
});
export type PriceListDefinition = z.infer<typeof priceListDefinitionSchema>;

export const priceListsTelegramSchema = z.object({
  /** A group from the Telegram settings (its id there); empty = not published. */
  groupId: z.string().trim().max(120),
  /** Publish the lists again after every applied price update (Excel in the panel or the bot). */
  autoPublish: z.boolean(),
});
export type PriceListsTelegram = z.infer<typeof priceListsTelegramSchema>;

export const priceListsConfigSchema = z.object({
  version: z.literal(1),
  lists: z.array(priceListDefinitionSchema).max(PRICE_LISTS_MAX)
    .refine((lists) => new Set(lists.map((list) => list.id)).size === lists.length, 'شناسهٔ دو لیست یکی است.'),
  telegram: priceListsTelegramSchema.default({ groupId: '', autoPublish: false }),
});
export type PriceListsConfig = z.infer<typeof priceListsConfigSchema>;

export const DEFAULT_PRICE_LISTS_CONFIG: PriceListsConfig = {
  version: 1,
  lists: [
    { id: 'mobile', title: 'لیست قیمت موبایل', categoryNames: ['گوشی موبایل'], brandNames: [], inStockOnly: true, enabled: true },
    { id: 'original', title: 'لیست قیمت محصولات اورجینال', categoryNames: [], brandNames: [], inStockOnly: true, enabled: false },
  ],
  telegram: { groupId: '', autoPublish: false },
};

export function parsePriceListsConfig(raw: string | null | undefined): PriceListsConfig {
  if (!raw) return DEFAULT_PRICE_LISTS_CONFIG;
  try {
    const parsed = priceListsConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_PRICE_LISTS_CONFIG;
  } catch {
    return DEFAULT_PRICE_LISTS_CONFIG;
  }
}

export interface PriceListRow {
  productId: string;
  title: string;
  color: string | null;
  /** Toman; null when the viewer may not see prices. */
  price: number | null;
  inStock: boolean;
}

export interface PriceListDTO {
  id: string;
  title: string;
  /** The latest change to any product in the list. */
  updatedAt: string | null;
  /** True when prices are withheld (the viewer is not an approved partner). */
  pricesHidden: boolean;
  groups: Array<{ brand: string; rows: PriceListRow[] }>;
}

export interface PriceListSummary {
  id: string;
  title: string;
  count: number;
}
