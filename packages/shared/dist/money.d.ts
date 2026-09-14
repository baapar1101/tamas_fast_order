/** Prices are stored as whole Toman — no decimals anywhere in the catalogue. */
export declare function formatMoney(value: number | string | null | undefined): string;
export declare function formatNumber(value: number | string | null | undefined): string;
export declare function toToman(value: unknown): number;
/**
 * Whether an old price is worth showing as a strikethrough.
 *
 * The legacy sheet carries a single fill-down value (482,000,000) in the
 * `old_price` column of almost every row, which would render the whole
 * catalogue as a 99% discount. A genuine sale is higher than the current price
 * but not by an implausible multiple.
 */
export declare function hasRealDiscount(price: number, oldPrice: number | null | undefined): boolean;
