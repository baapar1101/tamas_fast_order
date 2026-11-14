import { useEffect, useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ColorDTO, ProductGroupDTO } from '@tamas/shared';
import { api } from '../lib/api';

export interface BootstrapData {
  categories: CategoryDTO[];
  brands: BrandDTO[];
  colors: ColorDTO[];
  settings: Record<string, string>;
  slides?: StorefrontSlide[];
}

export interface StorefrontSlide {
  id: number;
  title: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
}

export function useBootstrap() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api.get<BootstrapData>('/catalog/bootstrap'),
    staleTime: 5 * 60_000,
  });
}

export interface CatalogFilters {
  q: string;
  category: string | null;
  brands: string[];
  promotion: boolean;
  basketOnly: boolean;
  sort: 'featured' | 'price_asc' | 'price_desc' | 'newest' | 'title';
}

interface ProductsResponse {
  groups: ProductGroupDTO[];
  total: number;
  page: number;
  perPage: number;
}

/** Drops any variant without price or stock that slipped through (e.g. cached rows). */
function sanitizeProducts(response: ProductsResponse): ProductsResponse {
  const groups = response.groups
    .map((group) => {
      const variants = group.variants.filter(
        (variant) =>
          variant.price > 0 &&
          (variant.stock > 0 || variant.kermanStock > 0 || variant.tehranStock > 0),
      );
      if (variants.length === 0) return null;

      return {
        ...group,
        variants,
        minPrice: Math.min(...variants.map((variant) => variant.price)),
        promotion: variants.some((variant) => variant.promotion),
      };
    })
    .filter((group): group is ProductGroupDTO => group !== null);

  return { ...response, groups };
}

export const PRODUCTS_PER_PAGE = 24;

/** Storefront catalog as an endless list: each page is fetched when the shopper nears the end. */
export function useProducts(filters: CatalogFilters) {
  return useInfiniteQuery({
    queryKey: ['products', filters],
    initialPageParam: 1,
    getNextPageParam: (last: ProductsResponse) =>
      last.page * last.perPage < last.total ? last.page + 1 : undefined,
    queryFn: async ({ signal, pageParam }) => {
      try {
        const response = await api.get<ProductsResponse>(
          '/catalog/products',
          {
            q: filters.q || undefined,
            category: filters.category ?? undefined,
            brands: filters.brands,
            promotion: filters.promotion || undefined,
            basketOnly: filters.basketOnly || undefined,
            inStock: true,
            sort: filters.sort,
            page: pageParam,
            perPage: PRODUCTS_PER_PAGE,
          },
          signal,
        );
        return sanitizeProducts(response);
      } catch (err) {
        // Inventory must always come from the same API/database used by the
        // admin panel. The legacy snapshot is intentionally not used here:
        // silently serving it after an API failure shows stale warehouse
        // counts and makes the storefront disagree with admin.
        if ((err as Error).name !== 'AbortError') {
          console.error('API products failed; refusing to display stale inventory:', err);
        }
        throw err;
      }
    },
    placeholderData: (previous) => previous,
  });
}

/** Keeps the search box responsive while the query only fires once typing stops. */
export function useDebounced<T>(value: T, delay = 320): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
