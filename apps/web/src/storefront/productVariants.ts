import type { ProductDTO } from '@tamas/shared';

type ProductColorFields = Pick<ProductDTO, 'color' | 'colorEn'>;
type ProductCategoryFields = Pick<ProductDTO, 'categoryName' | 'categoryFaName'>;

export function isPhoneProduct(product: ProductCategoryFields): boolean {
  return product.categoryFaName?.trim() === 'گوشی موبایل'
    || product.categoryName?.trim().toLowerCase() === 'mobile phones';
}

/** Imported model-level photo rows are not buyable colour variants. */
export function isPhoneMediaOnlyProduct(product: ProductDTO): boolean {
  return !product.color?.trim()
    && !product.colorEn?.trim()
    && !product.sku?.trim()
    && product.price <= 0
    && product.stock <= 0
    && product.kermanStock <= 0
    && product.tehranStock <= 0
    && Boolean(product.imageUrl || product.gallery.length);
}

function colorKey(product: ProductColorFields): string {
  return (product.color?.trim() || product.colorEn?.trim() || 'بدون رنگ')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200d\u200e\u200f]/g, '')
    .toLocaleLowerCase('fa-IR')
    .replace(/\s+/g, '');
}

function variantPriority(product: ProductDTO): number {
  const stock = product.stock + product.kermanStock + product.tehranStock;
  return (product.status === 'active' ? 100 : 0)
    + (product.price > 0 && stock > 0 ? 20 : 0)
    + (product.price > 0 ? 10 : 0)
    + (stock > 0 ? 2 : 0)
    + (product.sku?.trim() ? 1 : 0);
}

/** Show each phone colour once, without promoting photo-only rows to a fake black swatch. */
export function phoneDisplayVariants(variants: ProductDTO[]): ProductDTO[] {
  const byColor = new Map<string, ProductDTO>();
  for (const variant of variants) {
    if (isPhoneMediaOnlyProduct(variant)) continue;
    const key = colorKey(variant);
    const current = byColor.get(key);
    if (!current || variantPriority(variant) > variantPriority(current)) byColor.set(key, variant);
  }
  return [...byColor.values()];
}

export function phoneDefaultVariantIndex(variants: ProductDTO[]): number {
  const sellable = variants.findIndex((v) => v.price > 0 && v.stock + v.kermanStock + v.tehranStock > 0);
  if (sellable >= 0) return sellable;
  const priced = variants.findIndex((v) => v.price > 0);
  return priced >= 0 ? priced : 0;
}

/** A phone's gallery belongs to its model, not to the selected colour SKU. */
export function phoneModelImages(variants: ProductDTO[]): string[] {
  const ordered = [...variants].sort((a, b) =>
    Number(isPhoneMediaOnlyProduct(b)) - Number(isPhoneMediaOnlyProduct(a))
    || Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl))
    || b.gallery.length - a.gallery.length
    || a.productId.localeCompare(b.productId),
  );
  const images = ordered.flatMap((variant) => [variant.imageUrl, ...variant.gallery]);
  return [...new Set(images.filter((image): image is string => Boolean(image?.trim())))];
}
