export type HomepageFilterType = 'in_stock' | 'promotion' | 'basket';

export interface HomepageFilter {
  id: string;
  type: HomepageFilterType;
  label: string;
  enabled: boolean;
}

export const HOMEPAGE_FILTER_SETTING_KEY = 'storefront_filters';

export const HOMEPAGE_FILTER_TYPE_LABELS: Record<HomepageFilterType, string> = {
  in_stock: 'موجودی کالا',
  promotion: 'کالاهای جشنواره',
  basket: 'سبدهای جشنواره',
};

export const DEFAULT_HOMEPAGE_FILTERS: HomepageFilter[] = [
  { id: 'in-stock', type: 'in_stock', label: 'موجودها', enabled: true },
  { id: 'promotion', type: 'promotion', label: 'کالاهای جشنواره', enabled: true },
  { id: 'basket', type: 'basket', label: 'سبدهای جشنواره', enabled: true },
];

const FILTER_TYPES = new Set<HomepageFilterType>(['in_stock', 'promotion', 'basket']);

export function parseHomepageFilters(value: string | undefined): HomepageFilter[] {
  if (!value) return DEFAULT_HOMEPAGE_FILTERS;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_HOMEPAGE_FILTERS;
    return parsed.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Partial<HomepageFilter>;
      if (!candidate.type || !FILTER_TYPES.has(candidate.type)) return [];
      const label = typeof candidate.label === 'string'
        ? candidate.label
        : HOMEPAGE_FILTER_TYPE_LABELS[candidate.type];
      return [{
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `${candidate.type}-${index}`,
        type: candidate.type,
        label,
        enabled: candidate.enabled !== false,
      }];
    });
  } catch {
    return DEFAULT_HOMEPAGE_FILTERS;
  }
}
