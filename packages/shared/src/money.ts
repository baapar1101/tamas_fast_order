const rialFormatter = new Intl.NumberFormat('fa-IR');

/** Prices are stored as whole Toman — no decimals anywhere in the catalogue. */
export function formatMoney(value: number | string | null | undefined): string {
  return `${rialFormatter.format(Number(value ?? 0))} تومان`;
}

export function formatNumber(value: number | string | null | undefined): string {
  return rialFormatter.format(Number(value ?? 0));
}

export function toToman(value: unknown): number {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
