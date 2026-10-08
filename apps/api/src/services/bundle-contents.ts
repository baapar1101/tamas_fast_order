import type { BundleContentDTO, BundleItem } from '@tamas/shared';

/** Keep the bundle's stored order and quantities, even if a referenced product is missing. */
export function resolveBundleContents(
  items: BundleItem[],
  productNames: Array<{ productId: string; title: string }>,
): BundleContentDTO[] {
  const titleById = new Map(productNames.map(({ productId, title }) => [productId, title]));
  return items.map(({ productId, qty }) => ({
    productId,
    qty,
    title: titleById.get(productId) || `کالا با کد ${productId}`,
  }));
}
