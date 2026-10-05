import type { ColorDTO, ProductDTO } from '@tamas/shared';

const FALLBACK_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  blue: '#0000FF',
  green: '#008000',
  yellow: '#FFFF00',
  orange: '#FFA500',
  silver: '#C0C0C0',
  gold: '#FFD700',
  pink: '#FFC0CB',
  purple: '#800080',
  brown: '#8B4513',
  'مشکی': '#000000',
  'سفید': '#FFFFFF',
  'قرمز': '#FF0000',
  'آبی': '#0000FF',
  'سبز': '#008000',
  'زرد': '#FFFF00',
  'نارنجی': '#FFA500',
  'نقرهای': '#C0C0C0',
  'طلایی': '#FFD700',
  'صورتی': '#FFC0CB',
  'بنفش': '#800080',
  'قهوهای': '#8B4513',
};

function normalizeColorName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('fa-IR')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\s\u200c_-]+/g, '');
}

function normalizeHex(value: string | null | undefined): string | null {
  const code = value?.trim();
  if (!code || !/^#?[0-9a-f]{3,8}$/i.test(code)) return null;
  return code.startsWith('#') ? code : `#${code}`;
}

export function createColorMap(colors: ColorDTO[] | undefined): Map<string, string> {
  const map = new Map<string, string>();

  for (const [name, code] of Object.entries(FALLBACK_COLORS)) {
    map.set(normalizeColorName(name), code);
  }

  for (const color of colors ?? []) {
    const code = normalizeHex(color.code);
    if (!code) continue;
    if (color.name) map.set(normalizeColorName(color.name), code);
    if (color.faName) map.set(normalizeColorName(color.faName), code);
  }

  return map;
}

/** The displayed colour name is authoritative; a product-level hex is fallback only. */
export function resolveProductColor(product: ProductDTO, colorMap: Map<string, string>): string {
  for (const name of [product.color, product.colorEn]) {
    if (!name) continue;
    const mapped = colorMap.get(normalizeColorName(name));
    if (mapped) return mapped;
  }

  // ProductCard displays a missing colour name as «مشکی» for legacy rows.
  return normalizeHex(product.colorCode) ?? '#000000';
}
