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

/** Finds a live logical duplicate without confusing different colour/model variants. */
export async function findProductDuplicate(
  input: ProductIdentityInput,
  excludeId?: number,
): Promise<ProductDuplicate | null> {
  const rows = await db
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
    if (sourceId && productSourceId(row.digikalaLink) === sourceId) {
      return { id: row.id, productId: row.productId, title: row.title, reason: 'source' };
    }
    if (key && productIdentityKey(row) === key) {
      return { id: row.id, productId: row.productId, title: row.title, reason: 'identity' };
    }
  }
  return null;
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
