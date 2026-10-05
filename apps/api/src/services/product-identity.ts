export interface ProductIdentityInput {
  productId?: string | null;
  sku?: string | null;
  title?: string | null;
  model?: string | null;
  color?: string | null;
  colorEn?: string | null;
  type?: string | null;
  digikalaLink?: string | null;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Normalizes a value for duplicate comparison without changing display data. */
export function normalizeProductIdentity(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‍‎‏‪-‮]/g, '')
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .toLocaleLowerCase('fa-IR')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function productSourceId(value: unknown): string {
  const clean = String(value ?? '').trim();
  if (!clean) return '';
  const match = clean.match(/(?:dkp-|\/products?\/)(\d+)/i);
  return match?.[1] ?? normalizeProductIdentity(clean.replace(/[?#].*$/, '').replace(/\/$/, ''));
}

export function productIdentityKey(value: ProductIdentityInput): string {
  const title = normalizeProductIdentity(value.title);
  if (!title) return '';
  return [
    title,
    normalizeProductIdentity(value.model),
    normalizeProductIdentity(value.color) || normalizeProductIdentity(value.colorEn),
    normalizeProductIdentity(value.type || 'physical'),
  ].join('|');
}
