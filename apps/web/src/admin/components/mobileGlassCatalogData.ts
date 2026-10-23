import type { ProductDTO } from '@tamas/shared';

export interface MobileGlassBrandGroup {
  key: string;
  label: string;
  products: ProductDTO[];
}

function searchable(value: string | null | undefined): string {
  return String(value ?? '')
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACCESSORY_PATTERN = /لوازم|جانبی|اکسسوری|accessor|قاب|کاور|گلس|محافظ|کابل|شارژر|هندزفری|هدفون|پاوربانک/;
const PHONE_CATEGORY_PATTERN = /گوشی|تلفن همراه|smart\s*phone|mobile\s*phone|cell\s*phone|\bmobile\b|\bphone\b/;
const PHONE_TITLE_PATTERN = /\biphone\b|آیفون|\bgalaxy\s+[aszfm]\d|\bredmi\b|\bpoco\b|\bxiaomi\s+\d|\bhonor\s+\d|\bnokia\s+\d/;

export function isMobilePhoneProduct(product: ProductDTO): boolean {
  if (product.type === 'bundle') return false;
  const category = searchable(`${product.categoryFaName ?? ''} ${product.categoryName ?? ''}`);
  if (ACCESSORY_PATTERN.test(category)) return false;
  if (PHONE_CATEGORY_PATTERN.test(category)) return true;
  if (category) return false;
  return PHONE_TITLE_PATTERN.test(searchable(product.title));
}

function canonicalBrand(product: ProductDTO): { key: string; label: string; order: number } {
  const source = searchable(`${product.brandName ?? ''} ${product.brandFaName ?? ''} ${product.title}`);
  if (/samsung|galaxy|سامسونگ/.test(source)) return { key: 'samsung', label: 'SAMSUNG', order: 0 };
  if (/xiaomi|redmi|poco|شیائومی|ردمی|پوکو/.test(source)) return { key: 'xiaomi', label: 'XIAOMI', order: 1 };
  if (/apple|iphone|اپل|آیفون/.test(source)) return { key: 'iphone', label: 'iPhone', order: 2 };
  const label = product.brandName || product.brandFaName || 'سایر برندها';
  return { key: searchable(label) || 'other', label, order: 10 };
}

export function groupMobilePhoneProducts(products: ProductDTO[]): MobileGlassBrandGroup[] {
  const groups = new Map<string, MobileGlassBrandGroup & { order: number }>();
  products.filter(isMobilePhoneProduct).forEach((product) => {
    const brand = canonicalBrand(product);
    const existing = groups.get(brand.key);
    if (existing) existing.products.push(product);
    else groups.set(brand.key, { key: brand.key, label: brand.label, order: brand.order, products: [product] });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      products: group.products.sort((first, second) => {
        const firstModel = first.model || first.title;
        const secondModel = second.model || second.title;
        return firstModel.localeCompare(secondModel, 'fa', { numeric: true }) || (first.color || '').localeCompare(second.color || '', 'fa');
      }),
    }))
    .sort((first, second) => first.order - second.order || first.label.localeCompare(second.label, 'fa'))
    .map(({ order: _order, ...group }) => group);
}

