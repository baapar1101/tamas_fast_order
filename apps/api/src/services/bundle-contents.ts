import type { BundleContentDTO, BundleItem } from '@tamas/shared';

/** Keep the bundle's stored order and quantities, even if a referenced product is missing. */
export function resolveBundleContents(
  items: BundleItem[],
  products: Array<{ productId: string; title: string; imageUrl: string | null }>,
): BundleContentDTO[] {
  const productById = new Map(products.map((product) => [product.productId, product]));
  return items.map(({ productId, qty }) => ({
    productId,
    qty,
    title: productById.get(productId)?.title || `کالا با کد ${productId}`,
    imageUrl: productById.get(productId)?.imageUrl ?? null,
  }));
}
