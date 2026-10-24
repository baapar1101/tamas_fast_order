import type {
  ProductDTO,
  PaymentPlanQuote,
  PaymentMethodConfig,
  Warehouse,
} from "@tamas/shared";
export const ORIGIN = "https://tamasmarket.com";
export type CartLine = {
  product: ProductDTO;
  warehouse: Warehouse;
  qty: number;
};
export const ascii = (s: string) =>
  s
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
export const money = (n: number) =>
  `${Math.round(n).toLocaleString("fa-IR")} تومان`;
export const date = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("fa-IR") : "—";
export const plain = (v: string | null | undefined) =>
  (v || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
export const stockFor = (p: ProductDTO, w: Warehouse) =>
  p.status === "inactive"
    ? 0
    : p.kermanStock + p.tehranStock > 0
      ? w === "kerman"
        ? p.kermanStock
        : p.tehranStock
      : p.stock;
export const total = (lines: CartLine[]) =>
  lines.reduce((s, l) => s + l.product.price * l.qty, 0);
export function publicUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, ORIGIN);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function privateUrl(value: string): string {
  const u = new URL(value, ORIGIN);
  if (
    u.origin !== ORIGIN ||
    !/^\/api\/files\/\d+(?:\/thumbnail)?$/.test(u.pathname) ||
    u.search ||
    u.hash
  )
    throw new Error("نشانی مدرک خصوصی معتبر نیست.");
  return u.href;
}
export function productImages(products: ProductDTO[]): string[] {
  return [
    ...new Set(
      products
        .flatMap((p) => [p.imageUrl, ...p.gallery])
        .map(publicUrl)
        .filter((v): v is string => !!v),
    ),
  ];
}
export function changeCart(
  lines: CartLine[],
  product: ProductDTO,
  warehouse: Warehouse,
  qty: number,
): CartLine[] {
  const rest = lines.filter(
    (l) =>
      l.product.productId !== product.productId || l.warehouse !== warehouse,
  );
  const n = Math.min(Math.floor(qty), stockFor(product, warehouse));
  return n > 0 ? [...rest, { product, warehouse, qty: n }] : rest;
}
export function checkoutItems(lines: CartLine[]) {
  return lines.map((l) => ({
    productId: l.product.productId,
    warehouse: l.warehouse,
    qty: l.qty,
  }));
}
export function choosePlan(
  plans: PaymentPlanQuote[],
  kind: string,
  term?: number | null,
  interval?: number | null,
) {
  const byKind = plans.filter((p) => p.kind === kind);
  return (
    byKind.find(
      (p) =>
        (term == null || p.termMonths === term) &&
        (interval == null || p.installmentIntervalMonths === interval),
    ) ??
    byKind.find((p) => term == null || p.termMonths === term) ??
    byKind[0]
  );
}
export function restoreCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (l): l is CartLine =>
        !!l &&
        typeof l === "object" &&
        typeof l.product?.productId === "string" &&
        typeof l.product?.title === "string" &&
        Number.isFinite(l.product?.price) &&
        Number.isInteger(l.qty) &&
        l.qty > 0 &&
        ["kerman", "tehran"].includes(l.warehouse),
    )
    .slice(0, 200);
}
export function nativePaymentMethods(raw?: string): PaymentMethodConfig[] {
  const defaults: PaymentMethodConfig[] = [
    {
      id: "wallet",
      label: "کیف پول",
      desc: "پرداخت از موجودی کیف پول",
      enabled: true,
      type: "wallet",
    },
    {
      id: "aqayepardakht",
      label: "درگاه بانکی",
      desc: "پرداخت آنلاین امن",
      enabled: true,
      type: "online",
    },
    {
      id: "online",
      label: "واریز به حساب",
      desc: "اطلاعات حساب پس از ثبت فاکتور از سرور دریافت می‌شود",
      enabled: true,
      type: "manual",
    },
    {
      id: "credit_weekly",
      label: "اعتباری هفتگی",
      desc: "طبق سقف اعتبار و تأیید واحد مالی",
      enabled: true,
      type: "credit",
    },
  ];
  try {
    const parsed: unknown = JSON.parse(raw || "null");
    if (!Array.isArray(parsed) || !parsed.length) return defaults;
    const methods = parsed.flatMap((m: unknown) => {
      if (!m || typeof m !== "object") return [];
      const value = m as Partial<PaymentMethodConfig>;
      if (typeof value.id !== "string" || typeof value.label !== "string")
        return [];
      return [
        {
          ...value,
          id: value.id,
          label: value.label,
          desc: value.desc || "",
          enabled: value.enabled !== false,
          type: value.type || "custom",
        } as PaymentMethodConfig,
      ];
    });
    return methods.some((m) => m.id === "wallet")
      ? methods
      : [defaults[0]!, ...methods];
  } catch {
    return defaults;
  }
}
