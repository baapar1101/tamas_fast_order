import type { LandingSection } from '@tamas/shared';

/** The wholesale catalog's address. The home address shows the landing page. */
export const SHOP_PATH = '/shop';

/** Query keys the catalog reads; a home link carrying any of them belongs to the catalog. */
const CATALOG_PARAMS = ['q', 'cat', 'brand', 'promo', 'basket', 'credit', 'sort', 'view', 'tab', 'stock', 'page'];

export function hasCatalogParams(search: string): boolean {
  const params = new URLSearchParams(search);
  return CATALOG_PARAMS.some((key) => params.has(key));
}

/** Older banner and campaign links point at `/?brand=…`; send them to the catalog. */
export function shopHref(link: string): string {
  const clean = link.trim();
  if (clean.startsWith('/?') || clean.startsWith('/#')) return `${SHOP_PATH}${clean.slice(1)}`;
  return clean;
}

export function shopSearchHref(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `${SHOP_PATH}?${text}` : SHOP_PATH;
}

type FeaturedSection = Extract<LandingSection, { type: 'featured' }>;

/** Catalog API parameters for a featured-products section. */
export function featuredQuery(section: FeaturedSection) {
  return {
    promotion: section.source === 'promotion' ? true : undefined,
    category: section.source === 'category' && section.value ? section.value : undefined,
    brands: section.source === 'brand' && section.value ? [section.value] : undefined,
    sort: section.source === 'newest' ? 'newest' : 'price_asc',
    inStock: true,
    page: 1,
    perPage: section.limit,
  } as const;
}

/** «See all» link for a featured-products section: the same products in the catalog. */
export function featuredShopHref(section: FeaturedSection): string {
  return shopSearchHref({
    promo: section.source === 'promotion' ? '1' : undefined,
    cat: section.source === 'category' ? section.value || undefined : undefined,
    brand: section.source === 'brand' ? section.value || undefined : undefined,
    sort: section.source === 'newest' ? 'newest' : undefined,
  });
}
