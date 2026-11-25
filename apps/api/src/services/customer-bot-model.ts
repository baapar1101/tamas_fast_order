import {
  BLACK_FRIDAY_RIBBON,
  ORDER_STATUS_LABELS,
  REQUIRED_PROFILE_FIELDS,
  WAREHOUSE_LABELS,
  isValidPhone,
  normalizePhone,
  toAsciiDigits,
  type OrderDTO,
  type PaymentMethodConfig,
  type PaymentPlanQuote,
  type PaymentTermsQuoteResult,
  type ProductDTO,
  type SavedCartLineDTO,
  type Warehouse,
} from '@tamas/shared';

/*
 * Pure building blocks of the customer bot (Telegram and Bale): conversation
 * state, parsing, the payment options a cart may use and Persian formatting.
 * Nothing here touches the database, so the rules are unit-tested directly.
 */

export const BOT_SESSION_TTL_MS = 6 * 60 * 60_000;
export const BOT_PAGE_SIZE = 8;
/** SMS codes one bot user may request per hour, on top of the per-phone limits of the OTP service. */
export const BOT_OTP_LIMIT_PER_HOUR = 5;

/** Profile questions the bot can ask, in the order the site's form shows them. */
export const BOT_PROFILE_FIELDS = ['name', 'lastName', 'storeName', 'address', 'landline', 'postalCode'] as const;
export type BotProfileField = (typeof BOT_PROFILE_FIELDS)[number];

export const BOT_PROFILE_PROMPTS: Record<BotProfileField, string> = {
  name: 'نام خود را بنویسید:',
  lastName: 'نام خانوادگی خود را بنویسید:',
  storeName: 'نام فروشگاه یا کسب‌وکار خود را بنویسید:',
  address: 'آدرس کامل تحویل سفارش (استان، شهر، خیابان، پلاک) را بنویسید:',
  landline: 'تلفن ثابت فروشگاه را بنویسید (اختیاری):',
  postalCode: 'کد پستی ۱۰ رقمی را بنویسید (اختیاری):',
};

export const BOT_PROFILE_LABELS: Record<BotProfileField, string> = {
  name: 'نام',
  lastName: 'نام خانوادگی',
  storeName: 'نام فروشگاه',
  address: 'آدرس',
  landline: 'تلفن ثابت',
  postalCode: 'کد پستی',
};

/** Same choices as the credit form on the site. */
export const CREDIT_BUSINESS_TYPES = [
  { value: 'مغازه‌دار', label: 'مغازه‌دار / فروشگاه حضوری' },
  { value: 'عمده‌فروش', label: 'عمده‌فروش / بنکدار' },
  { value: 'آنلاین‌شاپ', label: 'آنلاین‌شاپ / پیج / سایت' },
  { value: 'شرکت', label: 'شرکت / سازمان خصوصی' },
  { value: 'غیره', label: 'سایر موارد' },
] as const;

/** Documents of a credit application, asked one after another. */
export const CREDIT_DOCUMENT_STEPS = [
  { field: 'nationalCardUrl', prompt: '🪪 تصویر روی کارت ملی را بفرستید.', optional: false },
  { field: 'businessDocsUrl', prompt: '📄 تصویر جواز کسب یا اجاره‌نامه محل کسب را بفرستید.', optional: false },
  { field: 'checkImageUrl', prompt: '🧾 تصویر یک برگ چک صیادی (نام صاحب حساب خوانا باشد) را بفرستید.', optional: false },
  { field: 'bankStatementUrl', prompt: '🏦 گردش حساب بانکی (تصویر یا PDF) را بفرستید. این مورد اختیاری است.', optional: true },
] as const;
export type CreditDocumentField = (typeof CREDIT_DOCUMENT_STEPS)[number]['field'];

export type BotStep =
  | { kind: 'login_phone' }
  | { kind: 'login_code'; phone: string }
  | { kind: 'profile'; field: BotProfileField; queue: BotProfileField[]; resume?: 'checkout' }
  | { kind: 'certificate' }
  | { kind: 'identity_code' }
  | { kind: 'identity_birth'; nationalCode: string }
  | { kind: 'credit_report' }
  | { kind: 'credit_national_id' }
  | { kind: 'credit_business' }
  | { kind: 'credit_document'; field: CreditDocumentField }
  | { kind: 'credit_referral' }
  | { kind: 'search' }
  | { kind: 'qty'; key: string }
  | { kind: 'checkout_address' }
  | { kind: 'checkout_discount' }
  | { kind: 'checkout_note' }
  | { kind: 'track' }
  | { kind: 'receipt'; orderId: number }
  | { kind: 'cheque_number'; orderId: number }
  | { kind: 'cheque_bank'; orderId: number; checkNumber: string }
  | { kind: 'cheque_image'; orderId: number; checkNumber: string; bankName: string };

export interface BotCreditDraft {
  nationalId?: string;
  businessType?: string;
  nationalCardUrl?: string;
  businessDocsUrl?: string;
  checkImageUrl?: string;
  bankStatementUrl?: string;
  referralInfo?: string;
}

export interface BotCheckoutDraft {
  method?: string;
  address?: string;
  discountCode?: string;
  note?: string;
  /** Option ids in the order the buttons were shown, so `cb:cm:<index>` stays short. */
  options?: string[];
}

export interface BotSession {
  step?: BotStep;
  browse?: { q?: string; category?: string; blackFriday?: boolean; page: number };
  checkout?: BotCheckoutDraft;
  credit?: BotCreditDraft;
  otpWindow?: { start: number; count: number };
}

const ORDER_CODE = /\bKP-\d{8}-\d{6}-\d{3}\b/i;

export function findOrderCode(text: string | undefined): string | null {
  const match = ORDER_CODE.exec(toAsciiDigits(text ?? ''));
  return match ? match[0].toUpperCase() : null;
}

/** A typed Iranian mobile number (Persian or Latin digits, +98/0098/0 prefixes), else null. */
export function parseMobile(text: string | undefined): string | null {
  const raw = toAsciiDigits(text ?? '').replace(/[\s\-()]/g, '');
  if (!/^\+?\d{10,14}$/.test(raw)) return null;
  const phone = normalizePhone(raw);
  return isValidPhone(phone) ? phone : null;
}

export function parseOtpCode(text: string | undefined): string | null {
  const code = toAsciiDigits(text ?? '').replace(/\D/g, '');
  return code.length >= 4 && code.length <= 8 ? code : null;
}

export function parseNationalCode(text: string | undefined): string | null {
  const code = toAsciiDigits(text ?? '').replace(/\D/g, '');
  return /^\d{10}$/.test(code) ? code : null;
}

export function parseQuantity(text: string | undefined): number | null {
  const qty = Number(toAsciiDigits(text ?? '').replace(/\D/g, ''));
  return Number.isSafeInteger(qty) && qty >= 1 && qty <= 10_000 ? qty : null;
}

/** Callback data must stay under Telegram's 64-byte limit, so products travel as base-36 database ids. */
export function productRef(id: number): string {
  return id.toString(36);
}

export function productLookupId(ref: string): string | null {
  return /^[0-9a-z]{1,10}$/i.test(ref) ? `~${ref.toLowerCase()}` : null;
}

const WAREHOUSE_CODES: Record<Warehouse, string> = { kerman: 'k', tehran: 't', site: 's' };

export function warehouseCode(warehouse: Warehouse): string {
  return WAREHOUSE_CODES[warehouse];
}

export function warehouseFromCode(code: string | undefined): Warehouse | null {
  return (Object.entries(WAREHOUSE_CODES).find(([, value]) => value === code)?.[0] as Warehouse | undefined) ?? null;
}

/** Units in one warehouse, using the same fallback as order creation. */
export function stockIn(product: Pick<ProductDTO, 'kermanStock' | 'tehranStock' | 'stock'>, warehouse: Warehouse): number {
  const split = product.kermanStock + product.tehranStock;
  if (split > 0) {
    if (warehouse === 'kerman') return product.kermanStock;
    if (warehouse === 'tehran') return product.tehranStock;
    return split;
  }
  return product.stock;
}

/** Warehouses a customer may order a variant from, like the storefront's buttons. */
export function orderableWarehouses(product: Pick<ProductDTO, 'price' | 'status' | 'kermanStock' | 'tehranStock' | 'stock'>): Warehouse[] {
  if (product.price <= 0 || product.status !== 'active') return [];
  if (product.kermanStock + product.tehranStock > 0) {
    return (['kerman', 'tehran'] as const).filter((warehouse) => stockIn(product, warehouse) > 0);
  }
  return product.stock > 0 ? ['site'] : [];
}

export function cartKey(productId: string, warehouse: Warehouse): string {
  return `${productId}::${warehouse}`;
}

/** Adds units of a variant to the cart, never beyond the stock the customer saw. */
export function addCartLine(
  lines: SavedCartLineDTO[],
  product: ProductDTO,
  warehouse: Warehouse,
  qty: number,
): { lines: SavedCartLineDTO[]; added: number; line: SavedCartLineDTO } {
  const key = cartKey(product.productId, warehouse);
  const maxStock = Math.max(0, stockIn(product, warehouse));
  const existing = lines.find((line) => line.key === key);
  const current = existing?.qty ?? 0;
  const nextQty = Math.min(maxStock, current + qty);
  const line: SavedCartLineDTO = {
    key,
    productId: product.productId,
    title: product.title.slice(0, 400),
    color: product.color?.slice(0, 80) ?? null,
    colorCode: product.colorCode?.slice(0, 40) ?? null,
    imageUrl: product.imageUrl?.slice(0, 1000) ?? null,
    price: Math.max(0, Math.round(product.price)),
    qty: Math.max(1, nextQty),
    warehouse,
    maxStock,
  };
  const others = lines.filter((item) => item.key !== key);
  if (nextQty <= 0) return { lines: others, added: 0, line };
  return { lines: existing ? lines.map((item) => (item.key === key ? line : item)) : [...others, line], added: nextQty - current, line };
}

export function setCartLineQty(lines: SavedCartLineDTO[], key: string, qty: number): SavedCartLineDTO[] {
  if (qty <= 0) return lines.filter((line) => line.key !== key);
  return lines.map((line) => (line.key === key ? { ...line, qty: Math.min(qty, line.maxStock > 0 ? line.maxStock : qty) } : line));
}

export function cartTotal(lines: SavedCartLineDTO[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

export interface BotWalletState {
  enabled: boolean;
  orderPaymentEnabled: boolean;
  isFrozen: boolean;
  balance: number;
}

export interface BotPaymentOption {
  id: string;
  label: string;
  amount: number;
  plan: PaymentPlanQuote | null;
  method: PaymentMethodConfig | null;
}

/**
 * The settlement choices of a cart, with the same rules as the storefront
 * checkout: the quote's plans first; configured methods only when the quote
 * does not enforce a settlement, and next to plans only wallet, gateway and
 * weekly credit. A Black Friday cart's quote enforces cash plans, so wallet
 * and weekly credit never appear for it (order creation rejects them too).
 */
export function checkoutPaymentOptions(
  quote: Pick<PaymentTermsQuoteResult, 'baseAmount' | 'plans' | 'enforcedSettlement'>,
  methods: PaymentMethodConfig[],
  wallet: BotWalletState | null,
): BotPaymentOption[] {
  const base = quote.baseAmount;
  const options: BotPaymentOption[] = quote.plans.map((plan) => ({ id: plan.id, label: plan.label, amount: plan.finalAmount, plan, method: null }));
  if (quote.enforcedSettlement) return options;
  const canUseWallet = Boolean(wallet?.enabled && wallet.orderPaymentEnabled && !wallet.isFrozen && wallet.balance >= base);
  for (const method of [...methods].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    if (method.enabled === false) continue;
    if (method.minAmount && base < method.minAmount) continue;
    if (method.maxAmount && base > method.maxAmount) continue;
    if (quote.plans.length > 0 && !['wallet', 'aqayepardakht', 'credit_weekly'].includes(method.id)) continue;
    if (method.id === 'wallet' && !canUseWallet) continue;
    if (options.some((option) => option.id === method.id)) continue;
    options.push({ id: method.id, label: method.label, amount: base, plan: null, method });
  }
  return options;
}

/** What `createOrder` receives for a chosen option, matching the storefront's request. */
export function orderPaymentFields(option: BotPaymentOption): { paymentMethod: string; paymentPlanId?: string } {
  return option.plan ? { paymentMethod: option.plan.id, paymentPlanId: option.plan.id } : { paymentMethod: option.id };
}

/** Default payment methods when the shop has not configured any (kept in step with the storefront). */
export const DEFAULT_BOT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'wallet', label: 'کیف پول تماس مارکت', desc: '', enabled: true, type: 'wallet', sortOrder: 0 },
  { id: 'aqayepardakht', label: 'پرداخت آنلاین (درگاه بانکی)', desc: '', enabled: true, type: 'online', sortOrder: 1 },
  { id: 'online', label: 'کارت به کارت / واریز به حساب', desc: '', enabled: true, type: 'manual', sortOrder: 2 },
  { id: 'credit_weekly', label: 'اعتباری هفتگی', desc: '', enabled: true, type: 'credit', sortOrder: 3 },
  { id: 'check_2_month', label: 'چکی دو ماهه', desc: '', enabled: true, type: 'cheque', sortOrder: 4 },
  { id: 'check_4_month', label: 'چکی چهار ماهه', desc: '', enabled: true, type: 'cheque', sortOrder: 5 },
];

/** Reads the `payment_methods` setting the same way the storefront does. */
export function parseBotPaymentMethods(json: string | undefined | null): PaymentMethodConfig[] {
  if (!json) return DEFAULT_BOT_PAYMENT_METHODS;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_BOT_PAYMENT_METHODS;
    const methods = parsed.map((m: Record<string, unknown>, idx): PaymentMethodConfig => ({
      id: String(m.id || `pm_${idx}`),
      label: String(m.label || 'روش پرداخت'),
      desc: String(m.desc || ''),
      enabled: m.enabled !== false,
      type: (m.type as PaymentMethodConfig['type']) || 'custom',
      instructions: m.instructions ? String(m.instructions) : undefined,
      minAmount: m.minAmount ? Number(m.minAmount) : undefined,
      maxAmount: m.maxAmount ? Number(m.maxAmount) : undefined,
      sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : idx + 1,
    }));
    return methods.some((method) => method.id === 'wallet') ? methods : [DEFAULT_BOT_PAYMENT_METHODS[0]!, ...methods];
  } catch {
    return DEFAULT_BOT_PAYMENT_METHODS;
  }
}

/** Which follow-up an unpaid order needs from the customer. */
export function orderPaymentAction(order: Pick<OrderDTO, 'status' | 'paymentStatus' | 'paymentMethod' | 'paymentPlan'>): 'gateway' | 'cheque' | 'receipt' | null {
  if (order.status === 'cancelled' || order.paymentStatus === 'paid') return null;
  if (order.paymentPlan?.kind === 'cheque') return 'cheque';
  if (order.paymentMethod === 'aqayepardakht') return 'gateway';
  if (order.paymentMethod === 'wallet') return null;
  if (order.paymentMethod === 'online' || order.paymentPlan?.requiresPaymentInfo || order.paymentPlan) return 'receipt';
  return null;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function money(value: number): string {
  return `${Math.round(value).toLocaleString('fa-IR')} تومان`;
}

export function faNumber(value: number): string {
  return value.toLocaleString('fa-IR');
}

export function scheduleAmount(row: { amount: number | null; percent: number | null }): string {
  if (row.amount != null) return money(row.amount);
  return row.percent != null ? `${faNumber(row.percent)}٪ مبلغ` : '—';
}

const PAYMENT_STATUS_LABELS: Record<OrderDTO['paymentStatus'], string> = {
  paid: 'پرداخت‌شده ✅',
  unpaid: 'پرداخت‌نشده',
  pending: 'در انتظار تأیید پرداخت',
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status;
}

export function formatOrderLine(order: Pick<OrderDTO, 'orderCode' | 'status' | 'total' | 'createdAt'>): string {
  return `• <code>${escapeHtml(order.orderCode)}</code> — ${escapeHtml(orderStatusLabel(order.status))}\n  ${money(order.total)} · ${new Date(order.createdAt).toLocaleDateString('fa-IR')}`;
}

export function formatOrderDetail(order: OrderDTO): string {
  const items = order.items.slice(0, 25).map((item) => {
    const color = item.color ? ` (${escapeHtml(item.color)})` : '';
    return `• ${escapeHtml(item.title)}${color} × ${faNumber(item.qty)} — ${money(item.price * item.qty)}`;
  });
  if (order.items.length > 25) items.push(`… و ${faNumber(order.items.length - 25)} قلم دیگر`);
  const lines = [
    `<b>📦 سفارش <code>${escapeHtml(order.orderCode)}</code></b>`,
    '',
    `وضعیت: <b>${escapeHtml(orderStatusLabel(order.status))}</b>`,
    `پرداخت: ${PAYMENT_STATUS_LABELS[order.paymentStatus] ?? escapeHtml(order.paymentStatus)}`,
    `روش تسویه: ${escapeHtml(order.paymentPlan?.label ?? paymentMethodLabel(order.paymentMethod))}`,
    `تاریخ ثبت: ${new Date(order.createdAt).toLocaleDateString('fa-IR')}`,
  ];
  if (order.discountAmount > 0) lines.push(`تخفیف: ${money(order.discountAmount)}`);
  lines.push(`مبلغ قابل پرداخت: <b>${money(order.total)}</b>`, '', '<b>اقلام:</b>', ...items);
  if (order.address) lines.push('', `📍 ${escapeHtml(order.address)}`);
  const schedule = order.paymentPlan?.schedule ?? [];
  if (schedule.length > 1) {
    lines.push('', '<b>برنامه پرداخت:</b>', ...schedule.map((row) => `• ${escapeHtml(row.dueLabel)}: ${scheduleAmount(row)}`));
  }
  if (order.paymentInstructions?.status === 'sent' && order.paymentInstructions.instructions) {
    lines.push('', '<b>اطلاعات پرداخت:</b>', escapeHtml(order.paymentInstructions.instructions));
  } else if (order.paymentInstructions?.status === 'pending') {
    lines.push('', '⏳ اطلاعات حساب برای پرداخت به‌زودی از طرف واحد مالی ارسال می‌شود.');
  }
  return lines.join('\n');
}

export function paymentMethodLabel(method: string | null): string {
  if (!method) return 'ثبت نشده';
  return DEFAULT_BOT_PAYMENT_METHODS.find((item) => item.id === method)?.label ?? method;
}

export function warehouseLabel(warehouse: Warehouse): string {
  return WAREHOUSE_LABELS[warehouse];
}

/** One product with its colours: prices only for approved partners, as on the site. */
export function formatProduct(product: ProductDTO, variants: ProductDTO[], canSeePrices: boolean): string {
  const all = variants.length ? variants : [product];
  const lines = [`<b>${escapeHtml(product.title)}</b>`];
  const meta = [product.brandFaName || product.brandName, product.categoryFaName || product.categoryName].filter(Boolean);
  if (meta.length) lines.push(escapeHtml(meta.join(' · ')));
  if (product.ribbon) lines.push(`🏷 ${escapeHtml(product.ribbon)}`);
  if (product.ribbon === BLACK_FRIDAY_RIBBON) lines.push('💵 این کالا فقط با پرداخت نقدی فروخته می‌شود.');
  if (product.warranty) lines.push(`🛡 گارانتی: ${escapeHtml(product.warranty)}`);
  lines.push('');
  for (const variant of all.slice(0, 15)) {
    const warehouses = orderableWarehouses(variant);
    const stock = warehouses.length
      ? warehouses.map((warehouse) => `${warehouseLabel(warehouse)}: ${faNumber(stockIn(variant, warehouse))}`).join(' | ')
      : 'ناموجود';
    const price = canSeePrices && variant.price > 0 ? ` — ${money(variant.price)}` : '';
    lines.push(`• ${escapeHtml(variant.color || 'بدون رنگ')}${price}\n  ${stock}`);
  }
  if (!canSeePrices) lines.push('', '🔒 قیمت‌های همکاری پس از ورود و تأیید حساب نمایش داده می‌شوند.');
  return lines.join('\n');
}

export function formatCart(lines: SavedCartLineDTO[], total: number): string {
  if (!lines.length) return '🛒 سبد خرید شما خالی است.';
  const rows = lines.map((line, index) => {
    const color = line.color ? ` (${escapeHtml(line.color)})` : '';
    return `${faNumber(index + 1)}. ${escapeHtml(line.title)}${color}\n   ${faNumber(line.qty)} عدد × ${money(line.price)} · ${escapeHtml(warehouseLabel(line.warehouse))}`;
  });
  return `<b>🛒 سبد خرید</b>\n\n${rows.join('\n')}\n\nجمع کالاها: <b>${money(total)}</b>`;
}

/** The required profile fields still empty, in the site's order (same list as order creation checks). */
export function profileMissingFields(user: Record<(typeof REQUIRED_PROFILE_FIELDS)[number], string | null>): BotProfileField[] {
  return REQUIRED_PROFILE_FIELDS.filter((field) => !String(user[field] ?? '').trim());
}
