const rialFormatter = new Intl.NumberFormat('fa-IR');

/** Prices are stored as whole Toman — no decimals anywhere in the catalogue. */
export function formatMoney(value: number | string | null | undefined): string {
  return `${rialFormatter.format(Number(value ?? 0))} تومان`;
}

export function formatNumber(value: number | string | null | undefined): string {
  return rialFormatter.format(Number(value ?? 0));
}

export function toToman(value: unknown): number {
  const normalized = String(value ?? '').replace(/[\u0660-\u0669\u06F0-\u06F9]/g, c => {
    const code = c.charCodeAt(0);
    return String.fromCharCode(code <= 0x0669 ? code - 0x0660 + 48 : code - 0x06F0 + 48);
  });
  const n = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** A "was" price beyond this multiple of the current price is data entry noise. */
const MAX_DISCOUNT_RATIO = 3;

/**
 * Whether an old price is worth showing as a strikethrough.
 *
 * The legacy sheet carries a single fill-down value (482,000,000) in the
 * `old_price` column of almost every row, which would render the whole
 * catalogue as a 99% discount. A genuine sale is higher than the current price
 * but not by an implausible multiple.
 */
export function hasRealDiscount(price: number, oldPrice: number | null | undefined): boolean {
  if (!oldPrice || !Number.isFinite(oldPrice) || price <= 0) return false;
  return oldPrice > price && oldPrice <= price * MAX_DISCOUNT_RATIO;
}
