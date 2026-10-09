import { and, eq, isNull, ne, not, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { categories, products } from '../db/schema.js';

export const catalogExportScopeSchema = z.enum(['all', 'festival_singles', 'baskets']);
export type CatalogExportScope = z.infer<typeof catalogExportScopeSchema>;

/** Basket category is shared by physical baskets and the legacy Yesido bundle. */
export function catalogExportScopeFilter(scope: CatalogExportScope): SQL | undefined {
  if (scope === 'all') return undefined;

  const isBasket = or(eq(categories.name, 'Bondle'), eq(categories.faName, 'سبد ها'))!;
  if (scope === 'baskets') return isBasket;

  // A single festival product is promoted but must not be a basket or bundle.
  return and(
    eq(products.promotion, true),
    ne(products.type, 'bundle'),
    or(isNull(products.categoryId), not(isBasket)),
  );
}
