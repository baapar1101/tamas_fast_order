import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  FLASH_SALE_SETTING_KEY,
  discountPercent,
  flashSalePrice,
  flashSaleWindow,
  parseFlashSaleConfig,
  type FlashSaleConfig,
  type FlashSaleShowcase,
  type ProductDTO,
} from '@tamas/shared';
import { db } from '../db/client.js';
import { brands, categories, products } from '../db/schema.js';
import { catalogCache } from '../lib/cache.js';
import { getSetting } from './settings.js';
import { toProductDTO } from './catalog.js';

export async function getFlashSaleConfig(): Promise<FlashSaleConfig> {
  return parseFlashSaleConfig(await getSetting(FLASH_SALE_SETTING_KEY));
}

/** Part of every catalog cache key, so cached prices flip exactly when the window opens or closes. */
export function flashSaleCacheTag(config: FlashSaleConfig, now: Date = new Date()): string {
  if (!config.enabled || config.items.length === 0) return 'off';
  const window = flashSaleWindow(config, now);
  return window.active ? `on:${window.startsAt.getTime()}` : 'off';
}

/** The product as shoppers see it right now: sale price, with the regular price struck through. */
export function applyFlashSale(dto: ProductDTO, config: FlashSaleConfig, now: Date = new Date()): ProductDTO {
  const salePrice = flashSalePrice(config, dto.productId, dto.price, now);
  if (salePrice == null) return dto;
  return { ...dto, flashSale: true, oldPrice: dto.price, price: salePrice, discount: discountPercent(dto.price, salePrice) };
}

/** Regular prices of listed products, for validating an admin's sale prices. */
export async function regularPrices(productIds: string[]): Promise<Map<string, { price: number; title: string }>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.select({ productId: products.productId, price: products.price, title: products.title })
    .from(products)
    .where(and(inArray(products.productId, productIds), isNull(products.deletedAt)));
  return new Map(rows.map((row) => [row.productId, { price: row.price, title: row.title }]));
}

/**
 * The home page section: the sale's hours and its products. Before the window
 * opens products carry their regular price and `salePrice` announces the deal;
 * inside it the catalog price itself is the sale price.
 */
export async function flashSaleShowcase(now: Date = new Date()): Promise<FlashSaleShowcase | null> {
  const config = await getFlashSaleConfig();
  if (!config.enabled || config.items.length === 0) return null;
  const window = flashSaleWindow(config, now);
  const cacheKey = `flash-sale:${flashSaleCacheTag(config, now)}:${JSON.stringify(config)}`;
  const items = await catalogCache.wrap(cacheKey, async () => {
    const rows = await db
      .select({
        product: products,
        category: { name: categories.name, faName: categories.faName },
        brand: { name: brands.name, faName: brands.faName },
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(and(inArray(products.productId, config.items.map((item) => item.productId)), isNull(products.deletedAt), eq(products.status, 'active')));
    const byId = new Map(rows.map((row) => [row.product.productId, row]));
    return config.items.flatMap((item) => {
      const row = byId.get(item.productId);
      if (!row || row.product.price <= 0) return [];
      const regularPrice = row.product.price;
      // Price the item as if the window were open, so the card can announce it.
      const salePrice = flashSalePrice({ ...config, startHour: 0, endHour: 24 }, item.productId, regularPrice, now);
      if (salePrice == null) return [];
      return [{
        product: applyFlashSale(toProductDTO(row.product, row.category, row.brand), config, now),
        regularPrice,
        salePrice,
        percent: discountPercent(regularPrice, salePrice),
      }];
    });
  }) as FlashSaleShowcase['items'];
  if (items.length === 0) return null;
  return {
    title: config.title,
    subtitle: config.subtitle,
    startHour: config.startHour,
    endHour: config.endHour,
    active: window.active,
    startsAt: window.startsAt.toISOString(),
    endsAt: window.endsAt.toISOString(),
    serverTime: now.toISOString(),
    items,
  };
}
