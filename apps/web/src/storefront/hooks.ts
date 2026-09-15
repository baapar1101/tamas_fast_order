import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ColorDTO, ProductGroupDTO } from '@tamas/shared';
import { api } from '../lib/api';
import { getFallbackBootstrap, getFallbackProducts } from './fallbackData';

export interface BootstrapData {
  categories: CategoryDTO[];
  brands: BrandDTO[];
  colors: ColorDTO[];
  settings: Record<string, string>;
}

export function useBootstrap() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: async () => {
      try {
        return await api.get<BootstrapData>('/catalog/bootstrap');
      } catch (err) {
        console.warn('API bootstrap failed, falling back to legacy catalog snapshot:', err);
        return getFallbackBootstrap();
      }
    },
    staleTime: 5 * 60_000,
  });
}

export interface CatalogFilters {
  q: string;
  category: string | null;
  brands: string[];
  promotion: boolean;
  sort: 'price_asc' | 'price_desc' | 'newest' | 'title';
  page: number;
}

interface ProductsResponse {
  groups: ProductGroupDTO[];
  total: number;
  page: number;
  perPage: number;
}

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

export function useProducts(filters: CatalogFilters) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async ({ signal }) => {
      try {
        const response = await api.get<ProductsResponse>(
          '/catalog/products',
          {
            q: filters.q || undefined,
            category: filters.category ?? undefined,
            brands: filters.brands,
            promotion: filters.promotion || undefined,
            sort: filters.sort,
            page: filters.page,
            perPage: 24,
          },
          signal,
        );
        return sanitizeProducts(response);
      } catch (err) {
        console.warn('API products failed, falling back to legacy catalog snapshot:', err);
        return sanitizeProducts(getFallbackProducts(filters));
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
