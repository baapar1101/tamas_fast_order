import { isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { products } from '../db/schema.js';
import {
  normalizeProductIdentity,
  productIdentityKey,
  productSourceId,
  type ProductIdentityInput,
} from './product-identity.js';

export type ProductDuplicateReason = 'productId' | 'sku' | 'source' | 'identity';

export interface ProductDuplicate {
  id: number;
  productId: string;
  title: string;
  reason: ProductDuplicateReason;
}

export type DuplicateCandidate = Pick<typeof products.$inferSelect,
  'id' | 'productId' | 'sku' | 'title' | 'model' | 'color' | 'colorEn' | 'type' | 'digikalaLink'>;

/** Every live product, in the shape the duplicate check needs (load once for bulk work). */
export async function loadDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  return db
    .select({
      id: products.id,
      productId: products.productId,
      sku: products.sku,
      title: products.title,
      model: products.model,
      color: products.color,
      colorEn: products.colorEn,
      type: products.type,
      digikalaLink: products.digikalaLink,
    })
    .from(products)
    .where(isNull(products.deletedAt));
}

export interface DuplicateMatchOptions {
  /**
   * Imports identify products by their accounting code (SKU / product code)
   * alone: a product renamed on the site, or two products sharing a name,
   * must not be matched by title, model or colour.
   */
  codesOnly?: boolean;
}

/** Finds a logical duplicate among `rows` without confusing different colour/model variants. */
export function matchProductDuplicate(
  rows: DuplicateCandidate[],
  input: ProductIdentityInput,
  excludeId?: number,
  options: DuplicateMatchOptions = {},
): ProductDuplicate | null {
  const productId = normalizeProductIdentity(input.productId);
  const sku = normalizeProductIdentity(input.sku);
  const sourceId = productSourceId(input.digikalaLink);
  const key = productIdentityKey(input);

  for (const row of rows) {
    if (row.id === excludeId) continue;
    if (productId && normalizeProductIdentity(row.productId) === productId) {
      return { id: row.id, productId: row.productId, title: row.title, reason: 'productId' };
    }
    if (sku && normalizeProductIdentity(row.sku) === sku) {
      return { id: row.id, productId: row.productId, title: row.title, reason: 'sku' };
    }
    if (options.codesOnly) continue;
    if (sourceId && productSourceId(row.digikalaLink) === sourceId) {
      return { id: row.id, productId: row.productId, title: row.title, reason: 'source' };
    }
    if (key && productIdentityKey(row) === key) {
      return { id: row.id, productId: row.productId, title: row.title, reason: 'identity' };
    }
  }
  return null;
}

/** Finds a live logical duplicate without confusing different colour/model variants. */
export async function findProductDuplicate(
  input: ProductIdentityInput,
  excludeId?: number,
  options: DuplicateMatchOptions = {},
): Promise<ProductDuplicate | null> {
  return matchProductDuplicate(await loadDuplicateCandidates(), input, excludeId, options);
}

export function duplicateProductMessage(duplicate: ProductDuplicate): string {
  const reason = duplicate.reason === 'productId'
    ? 'کد کالا'
    : duplicate.reason === 'sku'
      ? 'SKU'
      : duplicate.reason === 'source'
        ? 'لینک منبع'
        : 'عنوان، مدل و رنگ';
  return `کالای تکراری است: «${duplicate.title}» با کد ${duplicate.productId} قبلاً ثبت شده (تطابق ${reason}).`;
}
