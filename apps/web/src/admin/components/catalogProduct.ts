import type { ProductDTO } from '@tamas/shared';
import { resolveImageUrl } from '../../lib/images';

export function catalogProductImage(product: Pick<ProductDTO, 'imageUrl' | 'gallery'>): string {
  const primaryImage = product.imageUrl?.trim();
  const galleryImage = product.gallery?.find((image) => Boolean(image?.trim()))?.trim();
  return resolveImageUrl(primaryImage || galleryImage);
}

/** Warehouse counts are authoritative when present; otherwise use legacy flat stock. */
export function catalogProductStock(product: Pick<ProductDTO, 'stock' | 'kermanStock' | 'tehranStock'>): number {
  const warehouseStock = Math.max(0, product.kermanStock) + Math.max(0, product.tehranStock);
  return warehouseStock > 0 ? warehouseStock : Math.max(0, product.stock);
}
