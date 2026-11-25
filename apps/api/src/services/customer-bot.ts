import {
  CREDIT_STATUS_DESCRIPTIONS,
  CREDIT_STATUS_LABELS,
  creditApplicationWriteSchema,
  profileWriteSchema,
  type CatalogQuery,
  type CategoryDTO,
  type CreditApplicationWrite,
  type CreditStatus,
  type OrderCreate,
  type OrderDTO,
  type PaymentMethodConfig,
  type ProductDTO,
  type ProductGroupDTO,
  type ProfileWrite,
  type SavedCartLineDTO,
} from '@tamas/shared';
import type { UserRow } from './auth.js';
import type { CartPaymentQuote } from './cart-quote.js';
import {
  BOT_OTP_LIMIT_PER_HOUR,
  BOT_PAGE_SIZE,
  BOT_PROFILE_FIELDS,
  BOT_PROFILE_LABELS,
  BOT_PROFILE_PROMPTS,
  CREDIT_BUSINESS_TYPES,
  CREDIT_DOCUMENT_STEPS,
  addCartLine,
  cartKey,
  cartTotal,
  checkoutPaymentOptions,
  escapeHtml,
  faNumber,
  findOrderCode,
  formatCart,
  formatOrderDetail,
  formatOrderLine,
  formatProduct,
  money,
  orderPaymentAction,
  orderPaymentFields,
  orderableWarehouses,
  parseMobile,
  parseNationalCode,
  parseOtpCode,
  parseQuantity,
  productLookupId,
  productRef,
  profileMissingFields,
  scheduleAmount,
  setCartLineQty,
  stockIn,
  warehouseCode,
  warehouseFromCode,
  warehouseLabel,
  type BotPaymentOption,
  type BotProfileField,
  type BotSession,
  type BotStep,
  type BotWalletState,
  type CreditDocumentField,
} from './customer-bot-model.js';

/*
 * The customer bot's conversation engine, shared by the Telegram and Bale
 * customer bots. It holds no business rules of its own: sign-up goes through
 * the site's OTP service, orders through `createOrder` (stock, prices, the
 * cash-only Black Friday rule), documents through the upload and credit
 * services. Everything it needs comes in through `CustomerBotDeps`, so a whole
 * conversation can be tested without a database or a bot token.
 */

export type BotPlatform = 'telegram' | 'bale';

export interface BotButton {
  text: string;
  data?: string;
  url?: string;
}
export type BotButtons = BotButton[][];

export interface BotSendOptions {
  buttons?: BotButtons;
  /** Shows a one-time «share my number» keyboard button with this label. */
  contactButton?: string;
  /** Hides a «share my number» keyboard left from the login step (only without `buttons`). */
  removeKeyboard?: boolean;
}

export interface BotTransport {
  send(chatId: string, html: string, options?: BotSendOptions): Promise<void>;
  sendPhoto?(chatId: string, photoUrl: string, captionHtml: string, options?: BotSendOptions): Promise<void>;
  download(fileId: string): Promise<{ buffer: Buffer; mimeType?: string; filename?: string }>;
}

export interface BotIncomingFile {
  fileId: string;
  photo: boolean;
  mimeType?: string;
  fileName?: string;
  size?: number;
}

export interface BotIncoming {
  botUserId: string;
  chatId: string;
  text?: string;
  callbackData?: string;
  /** A shared contact's phone, only when the platform confirmed it is the sender's own number. */
  ownContactPhone?: string;
  file?: BotIncomingFile;
}

export interface BotChannel {
  platform: BotPlatform;
  transport: BotTransport;
  siteUrl: string;
  supportUrl?: string;
  /** The site account this bot user is linked to, if any. */
  linkedUserId(): Promise<number | null>;
  /** Links this bot user to a site account after a verified login. */
  link(userId: number): Promise<void>;
  /** Platform-only rows for the main menu (notification settings, disconnect…). */
  extraMenuRows?: BotButtons;
}

export interface BotCreditSummary {
  status: CreditStatus | string;
  assignedCreditLimit: number;
  rejectionReason: string | null;
  pendingChequeAmount: number;
  bouncedCheques: number;
}

export interface BotWalletSummary {
  balance: number;
  lifetimeCredit: number;
  lifetimeDebit: number;
  isFrozen: boolean;
}

export interface CustomerBotDeps {
  sessions: {
    load(platform: BotPlatform, botUserId: string): Promise<BotSession>;
    save(platform: BotPlatform, botUserId: string, chatId: string, session: BotSession): Promise<void>;
  };
  users: {
    byId(id: number): Promise<UserRow | null>;
    byPhone(phone: string): Promise<UserRow | null>;
    findOrCreate(phone: string): Promise<{ row: UserRow; isNew: boolean }>;
  };
  otp: {
    send(phone: string): Promise<void>;
    verify(phone: string, code: string): Promise<boolean>;
  };
  catalog: {
    categories(): Promise<CategoryDTO[]>;
    search(query: Partial<CatalogQuery>): Promise<{ groups: ProductGroupDTO[]; total: number; page: number; perPage: number }>;
    product(lookupId: string): Promise<{ product: ProductDTO; variants: ProductDTO[] } | null>;
  };
  cart: {
    get(userId: number): Promise<SavedCartLineDTO[]>;
    save(userId: number, lines: SavedCartLineDTO[]): Promise<void>;
    clear(userId: number): Promise<void>;
  };
  checkout: {
    quote(items: Array<{ productId: string; qty: number }>): Promise<CartPaymentQuote>;
    paymentMethods(): Promise<PaymentMethodConfig[]>;
    wallet(userId: number): Promise<BotWalletState | null>;
    createOrder(user: UserRow, input: OrderCreate): Promise<OrderDTO>;
    gatewayUrl(userId: number, orderId: number): Promise<string>;
    submitPaymentInfo(userId: number, body: {
      orderId: number;
      paymentMethod: string;
      refNumber?: string;
      receiptNote?: string;
      receiptImageUrl?: string;
      checkNumber?: string;
      checkBankName?: string;
    }): Promise<{ ok: boolean; message: string }>;
  };
  orders: {
    list(userId: number): Promise<OrderDTO[]>;
    /** Any order by its code; the engine checks it belongs to the customer. */
    byCode(orderCode: string): Promise<OrderDTO | null>;
  };
  profile: {
    save(user: UserRow, body: ProfileWrite): Promise<{ complete: boolean; missing: string[] }>;
    verifyIdentity(user: UserRow, nationalCode: string, birthDate: string): Promise<{ message: string }>;
  };
  credit: {
    summary(userId: number): Promise<BotCreditSummary | null>;
    hasFreshReport(userId: number): Promise<boolean>;
    storeReport(user: UserRow, file: { buffer: Buffer; filename?: string; mimeType?: string }): Promise<{ message: string }>;
    submit(user: UserRow, body: CreditApplicationWrite): Promise<{ status: string }>;
  };
  wallet: {
    summary(userId: number): Promise<BotWalletSummary | null>;
  };
  uploads: {
    /** Stores a customer document privately; `credit` for identity/credit papers, `payment` for receipts. */
    store(userId: number, file: { buffer: Buffer; filename: string; mimeType: string }, scope: 'credit' | 'payment'): Promise<string>;
  };
}

interface Ctx {
  channel: BotChannel;
  input: BotIncoming;
  deps: CustomerBotDeps;
  session: BotSession;
  user: UserRow | null;
  dirty: boolean;
}

/** Callback data the engine owns. Platform adapters route everything starting with this to it. */
export const BOT_CALLBACK_PREFIX = 'cb:';

/** A user-facing failure: its message is shown as is. */
export class BotUserError extends Error {}

const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function send(ctx: Ctx, html: string, options?: BotSendOptions): Promise<void> {
  return ctx.channel.transport.send(ctx.input.chatId, html, options);
}

function btn(text: string, data: string): BotButton {
  return { text, data: `${BOT_CALLBACK_PREFIX}${data}` };
}

function setStep(ctx: Ctx, step: BotStep | undefined): void {
  ctx.session.step = step;
  ctx.dirty = true;
}

function canSeePrices(ctx: Ctx): boolean {
  return Boolean(ctx.user?.isActive);
}

const CANCEL_ROW: BotButton[] = [btn('❌ انصراف', 'x')];
const MENU_ROW: BotButton[] = [btn('🏠 منوی اصلی', 'm')];

function persianMessage(error: unknown): string {
  if (error instanceof BotUserError) return error.message;
  const message = error instanceof Error ? error.message : '';
  const status = (error as { statusCode?: number } | null)?.statusCode;
  // Service errors (AppError) carry Persian text meant for customers; anything
  // else may be an internal detail and is replaced by a generic sentence.
  if (message && /[؀-ۿ]/.test(message) && (status === undefined || status < 500)) return message;
  return 'عملیات انجام نشد. کمی بعد دوباره تلاش کنید.';
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export async function handleCustomerBotInput(channel: BotChannel, input: BotIncoming, deps: CustomerBotDeps): Promise<void> {
  const session = await deps.sessions.load(channel.platform, input.botUserId);
  const userId = await channel.linkedUserId();
  const user = userId ? await deps.users.byId(userId) : null;
  const ctx: Ctx = { channel, input, deps, session, user, dirty: false };
  try {
    if (input.callbackData) await onCallback(ctx, input.callbackData.startsWith(BOT_CALLBACK_PREFIX) ? input.callbackData.slice(BOT_CALLBACK_PREFIX.length) : input.callbackData);
    else if (input.ownContactPhone) await onContact(ctx, input.ownContactPhone);
    else if (input.file) await onFile(ctx, input.file);
    else await onText(ctx, (input.text ?? '').trim());
  } catch (error) {
    await send(ctx, `❌ ${escapeHtml(persianMessage(error))}`).catch(() => undefined);
  } finally {
    if (ctx.dirty) await deps.sessions.save(channel.platform, input.botUserId, input.chatId, ctx.session);
  }
}

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

const COMMANDS: Record<string, string> = {
  '/menu': 'm', '/products': 'cat', '/search': 's', '/cart': 'cart', '/orders': 'o', '/track': 't',
  '/profile': 'pf', '/credit': 'cr', '/wallet': 'w', '/login': 'login', '/signup': 'login', '/help': 'help',
  '/cancel': 'x', '/blackfriday': 'bf',
};

async function onText(ctx: Ctx, text: string): Promise<void> {
  if (text.startsWith('/')) {
    const command = text.split(/\s+/)[0]!.split('@')[0]!.toLowerCase();
    if (ctx.session.step) setStep(ctx, undefined);
    if (command === '/start') return showMenu(ctx, true);
    return onCallback(ctx, COMMANDS[command] ?? 'm');
  }
  const step = ctx.session.step;
  if (step) return onStepText(ctx, step, text);

  const orderCode = findOrderCode(text);
  if (orderCode) return trackOrder(ctx, orderCode);
  if (!ctx.user) {
    const phone = parseMobile(text);
    if (phone) return startOtp(ctx, phone);
  }
  if (text.length >= 2) return startBrowse(ctx, { q: text.slice(0, 100), page: 1 });
  return showMenu(ctx);
}

async function onCallback(ctx: Ctx, data: string): Promise<void> {
  const [action, ...args] = data.split(':');
  switch (action) {
    case 'm': setStep(ctx, undefined); return showMenu(ctx);
    case 'x': setStep(ctx, undefined); return showMenu(ctx);
    case 'help': return showHelp(ctx);
    case 'login': return askPhone(ctx);
    case 'lr': return resendOtp(ctx);
    case 'cat': return showCategories(ctx);
    case 'c': return showCategory(ctx, Number(args[0]));
    case 'bf': return startBrowse(ctx, { blackFriday: true, page: 1 });
    case 's': setStep(ctx, { kind: 'search' }); return send(ctx, '🔎 نام کالا، برند یا مدل گوشی را بنویسید:', { buttons: [CANCEL_ROW] });
    case 'pg': return showBrowsePage(ctx, Math.max(1, Number(args[0]) || 1));
    case 'p': return showProduct(ctx, args[0] ?? '');
    case 'a': return addToCart(ctx, args[0] ?? '', args[1], Number(args[2] ?? 1));
    case 'q': return askQuantity(ctx, args[0] ?? '', args[1]);
    case 'cart': return showCart(ctx);
    case 'ci': return changeCartLine(ctx, Number(args[0]), args[1] === '+' ? 1 : -1);
    case 'cd': return changeCartLine(ctx, Number(args[0]), 'remove');
    case 'cc': return clearCart(ctx);
    case 'co': return startCheckout(ctx);
    case 'cm': return chooseMethod(ctx, Number(args[0]));
    case 'ca': return askCheckout(ctx, 'checkout_address', '📍 آدرس تحویل این سفارش را بنویسید:');
    case 'cad': return useProfileAddress(ctx);
    case 'cdc': return askCheckout(ctx, 'checkout_discount', '🎟 کد تخفیف را بنویسید (برای حذف کد، «-» بفرستید):');
    case 'cn': return askCheckout(ctx, 'checkout_note', '📝 توضیحات سفارش را بنویسید (برای حذف، «-» بفرستید):');
    case 'cok': return placeOrder(ctx);
    case 'o': return showOrders(ctx);
    case 'od': return showOrder(ctx, Number(args[0]));
    case 't': return askTrack(ctx);
    case 'pay': return payOnline(ctx, Number(args[0]));
    case 'rc': return startPaymentInfo(ctx, Number(args[0]));
    case 'skip': return skipStep(ctx);
    case 'pf': return showProfile(ctx);
    case 'pe': return askProfileField(ctx, args[0] as BotProfileField, []);
    case 'pfc': return completeProfile(ctx);
    case 'cert': return askCertificate(ctx);
    case 'id': return askIdentity(ctx);
    case 'cr': return showCredit(ctx);
    case 'cra': return startCreditApplication(ctx);
    case 'crn': return useSavedNationalCode(ctx);
    case 'crb': return chooseBusinessType(ctx, Number(args[0]));
    case 'crok': return submitCredit(ctx);
    case 'w': return showWallet(ctx);
    default: return showMenu(ctx);
  }
}

async function onStepText(ctx: Ctx, step: BotStep, text: string): Promise<void> {
  switch (step.kind) {
    case 'login_phone': {
      const phone = parseMobile(text);
      if (!phone) return send(ctx, 'شماره موبایل معتبر نیست. شماره را مثل ۰۹۱۲۳۴۵۶۷۸۹ بنویسید.', { buttons: [CANCEL_ROW] });
      return startOtp(ctx, phone);
    }
    case 'login_code': return verifyLogin(ctx, step.phone, text);
    case 'profile': return saveProfileAnswer(ctx, step.field, step.queue, text, step.resume);
    case 'identity_code': {
      const nationalCode = parseNationalCode(text);
      if (!nationalCode) return send(ctx, 'کد ملی باید ۱۰ رقم باشد. دوباره بنویسید:', { buttons: [CANCEL_ROW] });
      setStep(ctx, { kind: 'identity_birth', nationalCode });
      return send(ctx, '📅 تاریخ تولد شمسی را بنویسید (مثل ۱۳۷۰/۰۱/۱۵):', { buttons: [CANCEL_ROW] });
    }
    case 'identity_birth': return verifyIdentity(ctx, step.nationalCode, text);
    case 'credit_national_id': {
      const nationalId = parseNationalCode(text);
      if (!nationalId) return send(ctx, 'کد ملی باید ۱۰ رقم باشد. دوباره بنویسید:', { buttons: [CANCEL_ROW] });
      ctx.session.credit = { ...ctx.session.credit, nationalId };
      return askBusinessType(ctx);
    }
    case 'credit_referral': {
      ctx.session.credit = { ...ctx.session.credit, referralInfo: text.slice(0, 500) };
      return reviewCredit(ctx);
    }
    case 'search': setStep(ctx, undefined); return startBrowse(ctx, { q: text.slice(0, 100), page: 1 });
    case 'qty': return setQuantity(ctx, step.key, text);
    case 'checkout_address': {
      if (text.length < 10) return send(ctx, 'آدرس کوتاه است. آدرس کامل را بنویسید:', { buttons: [CANCEL_ROW] });
      ctx.session.checkout = { ...ctx.session.checkout, address: text.slice(0, 1000) };
      setStep(ctx, undefined);
      return showReview(ctx);
    }
    case 'checkout_discount': {
      ctx.session.checkout = { ...ctx.session.checkout, discountCode: text === '-' ? undefined : text.slice(0, 40) };
      setStep(ctx, undefined);
      return showReview(ctx);
    }
    case 'checkout_note': {
      ctx.session.checkout = { ...ctx.session.checkout, note: text === '-' ? undefined : text.slice(0, 1000) };
      setStep(ctx, undefined);
      return showReview(ctx);
    }
    case 'track': {
      setStep(ctx, undefined);
      return trackOrder(ctx, findOrderCode(text) ?? text.toUpperCase());
    }
    case 'receipt': {
      setStep(ctx, undefined);
      return submitPaymentInfo(ctx, step.orderId, { refNumber: text.slice(0, 120), receiptNote: text.slice(0, 500) });
    }
    case 'cheque_number': {
      const checkNumber = text.replace(/\s+/g, '').slice(0, 40);
      if (checkNumber.length < 3) return send(ctx, 'شماره صیادی چک را درست بنویسید:', { buttons: [CANCEL_ROW] });
      setStep(ctx, { kind: 'cheque_bank', orderId: step.orderId, checkNumber });
      return send(ctx, '🏦 نام بانک چک را بنویسید:', { buttons: [CANCEL_ROW] });
    }
    case 'cheque_bank': {
      if (text.length < 2) return send(ctx, 'نام بانک را بنویسید:', { buttons: [CANCEL_ROW] });
      setStep(ctx, { kind: 'cheque_image', orderId: step.orderId, checkNumber: step.checkNumber, bankName: text.slice(0, 80) });
      return send(ctx, '📷 تصویر چک را بفرستید (اختیاری).', { buttons: [[btn('⏭ بدون تصویر', 'skip')], CANCEL_ROW] });
    }
    case 'certificate':
    case 'credit_report':
    case 'credit_document':
    case 'cheque_image':
      return send(ctx, 'لطفاً فایل یا تصویر خواسته‌شده را بفرستید، یا «انصراف» را بزنید.', { buttons: [CANCEL_ROW] });
    case 'credit_business':
      return askBusinessType(ctx);
  }
}

async function onFile(ctx: Ctx, file: BotIncomingFile): Promise<void> {
  const step = ctx.session.step;
  if (!ctx.user || !step || !['certificate', 'credit_report', 'credit_document', 'receipt', 'cheque_image'].includes(step.kind)) {
    return send(ctx, 'برای ارسال مدرک، ابتدا از منوی «حساب و مدارک» یا «اعتبار» بخش مربوط را انتخاب کنید.', { buttons: [MENU_ROW] });
  }
  const user = ctx.user;
  if (file.size && file.size > MAX_UPLOAD_BYTES) throw new BotUserError('حجم فایل بیشتر از ۱۵ مگابایت است.');
  const downloaded = await ctx.channel.transport.download(file.fileId);
  const mimeType = (file.photo ? 'image/jpeg' : (file.mimeType || downloaded.mimeType || '')).toLowerCase();
  const filename = file.fileName || downloaded.filename || (mimeType === 'application/pdf' ? 'document.pdf' : 'photo.jpg');

  if (step.kind === 'credit_report') {
    const result = await ctx.deps.credit.storeReport(user, { buffer: downloaded.buffer, filename, mimeType });
    if (!(await ctx.deps.credit.hasFreshReport(user.id))) {
      setStep(ctx, undefined);
      return send(ctx, `${escapeHtml(result.message)}\n\nاین گزارش به‌طور خودکار خوانده نشد؛ پس از بررسی کارشناس با شما تماس می‌گیریم. اگر گزارش جدیدتری دارید، دوباره از بخش اعتبار ارسال کنید.`, { buttons: [MENU_ROW] });
    }
    await send(ctx, `✅ ${escapeHtml(result.message)}`);
    return askNationalId(ctx);
  }

  if (!ALLOWED_UPLOAD_TYPES.has(mimeType)) throw new BotUserError('فقط تصویر (JPG، PNG، WebP) یا فایل PDF پذیرفته می‌شود.');
  const scope = step.kind === 'receipt' || step.kind === 'cheque_image' ? 'payment' : 'credit';
  const url = await ctx.deps.uploads.store(user.id, { buffer: downloaded.buffer, filename, mimeType }, scope);

  if (step.kind === 'certificate') {
    setStep(ctx, undefined);
    await ctx.deps.profile.save(user, { ...profileBody(user), certificateFileUrl: url });
    return send(ctx, '✅ تصویر جواز کسب در پرونده شما ذخیره شد و پس از بررسی کارشناس تأیید می‌شود.', { buttons: [[btn('👤 حساب و مدارک', 'pf')], MENU_ROW] });
  }
  if (step.kind === 'credit_document') {
    ctx.session.credit = { ...ctx.session.credit, [step.field]: url };
    ctx.dirty = true;
    await send(ctx, '✅ دریافت شد.');
    return askNextCreditDocument(ctx, step.field);
  }
  if (step.kind === 'receipt') {
    setStep(ctx, undefined);
    return submitPaymentInfo(ctx, step.orderId, { receiptImageUrl: url });
  }
  if (step.kind === 'cheque_image') {
    setStep(ctx, undefined);
    return submitPaymentInfo(ctx, step.orderId, { checkNumber: step.checkNumber, checkBankName: step.bankName, receiptImageUrl: url });
  }
}

async function skipStep(ctx: Ctx): Promise<void> {
  const step = ctx.session.step;
  if (step?.kind === 'cheque_image') {
    setStep(ctx, undefined);
    return submitPaymentInfo(ctx, step.orderId, { checkNumber: step.checkNumber, checkBankName: step.bankName });
  }
  if (step?.kind === 'credit_document') return askNextCreditDocument(ctx, step.field);
  if (step?.kind === 'credit_referral') return reviewCredit(ctx);
  if (step?.kind === 'profile') return askNextProfileField(ctx, step.queue, step.resume);
  return showMenu(ctx);
}

/* ------------------------------------------------------------------ *
 * Menu & help
 * ------------------------------------------------------------------ */

function mainMenuButtons(ctx: Ctx): BotButtons {
  const site: BotButton = { text: '🌐 ورود به فروشگاه', url: ctx.channel.siteUrl };
  const rows: BotButtons = ctx.user
    ? [
      [btn('🛍 محصولات', 'cat'), btn('🔎 جستجو', 's')],
      [btn('🛒 سبد خرید', 'cart'), btn('📦 سفارش‌های من', 'o')],
      [btn('📍 پیگیری سفارش', 't'), btn('💳 کیف پول', 'w')],
      [btn('👤 حساب و مدارک', 'pf'), btn('🧾 اعتبار خرید', 'cr')],
      ...(ctx.channel.extraMenuRows ?? []),
      [btn('❓ راهنما', 'help'), site],
    ]
    : [
      [btn('🛍 محصولات', 'cat'), btn('🔎 جستجو', 's')],
      [btn('🔥 ویژه بلک فرایدی', 'bf')],
      [btn('🔑 ورود / ثبت‌نام', 'login')],
      [btn('❓ راهنما', 'help'), site],
    ];
  if (ctx.channel.supportUrl) rows.push([{ text: '💬 پشتیبانی', url: ctx.channel.supportUrl }]);
  return rows;
}

async function showMenu(ctx: Ctx, greeting = false): Promise<void> {
  const user = ctx.user;
  if (!user) {
    return send(ctx, `${greeting ? '<b>به ربات مشتریان تماس مارکت خوش آمدید 👋</b>\n\n' : '<b>منوی تماس مارکت</b>\n\n'}از اینجا می‌توانید محصولات را ببینید، ثبت‌نام کنید، مدارک بفرستید، سفارش ثبت کنید و سفارش‌ها را پیگیری کنید.\n\nبرای دیدن قیمت‌های همکاری و ثبت سفارش، «ورود / ثبت‌نام» را بزنید.`, { buttons: mainMenuButtons(ctx) });
  }
  const notes: string[] = [];
  const missing = profileMissingFields(user);
  if (missing.length) notes.push('📝 پروفایل شما کامل نیست. برای فعال شدن حساب همکاری آن را تکمیل کنید.');
  if (!user.isActive) notes.push('⏳ حساب همکاری شما در انتظار تأیید است. پس از تأیید، قیمت‌ها و ثبت سفارش فعال می‌شود.');
  const buttons = mainMenuButtons(ctx);
  if (missing.length) buttons.unshift([btn('📝 تکمیل پروفایل', 'pfc')]);
  const name = [user.name, user.lastName].filter(Boolean).join(' ');
  return send(ctx, `<b>${name ? `${escapeHtml(name)}، ` : ''}به تماس مارکت خوش آمدید</b>${notes.length ? `\n\n${notes.join('\n')}` : ''}\n\nیکی از گزینه‌ها را انتخاب کنید.`, { buttons });
}

async function showHelp(ctx: Ctx): Promise<void> {
  return send(ctx, [
    '<b>راهنمای ربات مشتریان تماس مارکت</b>',
    '',
    '🔑 /login — ورود یا ثبت‌نام با کد پیامکی',
    '🛍 /products — دسته‌بندی محصولات',
    '🔎 /search — جستجوی کالا (یا فقط نام کالا را بنویسید)',
    '🛒 /cart — سبد خرید و ثبت سفارش',
    '📦 /orders — سفارش‌های من',
    '📍 /track — پیگیری با کد سفارش (یا کد KP-… را بفرستید)',
    '👤 /profile — حساب، جواز کسب و احراز هویت',
    '🧾 /credit — درخواست اعتبار و وضعیت پرونده',
    '💳 /wallet — کیف پول',
    '❌ /cancel — لغو مرحله فعلی',
    '',
    'قیمت‌های همکاری فقط برای حساب‌های تأییدشده نمایش داده می‌شود. کالاهای «ویژه بلک فرایدی» فقط با پرداخت نقدی فروخته می‌شوند.',
  ].join('\n'), { buttons: [MENU_ROW] });
}

function requireUser(ctx: Ctx): UserRow {
  if (!ctx.user) throw new BotUserError('برای این بخش ابتدا وارد حساب خود شوید یا ثبت‌نام کنید: /login');
  return ctx.user;
}

function requireActiveUser(ctx: Ctx): UserRow {
  const user = requireUser(ctx);
  if (!user.isActive) throw new BotUserError('حساب همکاری شما هنوز تأیید نشده است. پس از تأیید، امکان خرید فعال می‌شود.');
  return user;
}

/* ------------------------------------------------------------------ *
 * Sign-up and login (the site's OTP flow)
 * ------------------------------------------------------------------ */

async function askPhone(ctx: Ctx): Promise<void> {
  if (ctx.user) return send(ctx, `شما با شماره <code>${escapeHtml(ctx.user.phone)}</code> وارد شده‌اید.`, { buttons: [MENU_ROW] });
  setStep(ctx, { kind: 'login_phone' });
  return send(ctx, '🔑 <b>ورود / ثبت‌نام</b>\n\nدکمه «ارسال شماره من» را بزنید یا شماره موبایل خود را بنویسید. یک کد تأیید پیامک می‌شود.', { contactButton: '📱 ارسال شماره من' });
}

async function startOtp(ctx: Ctx, phone: string): Promise<void> {
  // The site limits codes per phone; this also limits one bot user to a few numbers an hour.
  const now = Date.now();
  const window = ctx.session.otpWindow && now - ctx.session.otpWindow.start < 3_600_000 ? ctx.session.otpWindow : { start: now, count: 0 };
  if (window.count >= BOT_OTP_LIMIT_PER_HOUR) throw new BotUserError('تعداد درخواست کد زیاد بود. یک ساعت دیگر دوباره تلاش کنید.');
  ctx.session.otpWindow = { start: window.start, count: window.count + 1 };
  ctx.dirty = true;
  await ctx.deps.otp.send(phone);
  setStep(ctx, { kind: 'login_code', phone });
  return send(ctx, `کد تأیید به شماره <code>${escapeHtml(phone)}</code> پیامک شد. کد را همین‌جا بفرستید:`, {
    buttons: [[btn('🔁 ارسال دوباره کد', 'lr'), btn('✏️ تغییر شماره', 'login')], CANCEL_ROW],
  });
}

async function resendOtp(ctx: Ctx): Promise<void> {
  const step = ctx.session.step;
  if (step?.kind !== 'login_code') return askPhone(ctx);
  return startOtp(ctx, step.phone);
}

async function onContact(ctx: Ctx, phone: string): Promise<void> {
  if (ctx.user?.phone === phone) return showMenu(ctx);
  const existing = await ctx.deps.users.byPhone(phone);
  if (existing) {
    // The platform confirmed this is the sender's own number, as when linking from the site.
    await ctx.channel.link(existing.id);
    ctx.user = existing;
    setStep(ctx, undefined);
    await send(ctx, '✅ حساب تماس مارکت شما به ربات متصل شد.', { removeKeyboard: true });
    return showMenu(ctx);
  }
  // A new customer: sign-up still needs the site's SMS code.
  return startOtp(ctx, phone);
}

async function verifyLogin(ctx: Ctx, phone: string, text: string): Promise<void> {
  const code = parseOtpCode(text);
  const otherPhone = code ? null : parseMobile(text);
  if (otherPhone) return startOtp(ctx, otherPhone);
  if (!code) return send(ctx, 'کد تأیید را به‌صورت عدد بفرستید.', { buttons: [[btn('🔁 ارسال دوباره کد', 'lr')], CANCEL_ROW] });
  const verified = await ctx.deps.otp.verify(phone, code);
  if (!verified) return send(ctx, 'کد وارد شده صحیح نیست یا منقضی شده است.', { buttons: [[btn('🔁 ارسال دوباره کد', 'lr')], CANCEL_ROW] });
  const { row, isNew } = await ctx.deps.users.findOrCreate(phone);
  await ctx.channel.link(row.id);
  ctx.user = row;
  setStep(ctx, undefined);
  const missing = profileMissingFields(row);
  if (missing.length) {
    await send(ctx, isNew
      ? '🎉 <b>ثبت‌نام شما در تماس مارکت انجام شد.</b>\n\nبرای فعال شدن حساب همکاری و دیدن قیمت‌ها، چند سؤال کوتاه پروفایل را جواب دهید.'
      : '✅ وارد حساب خود شدید. پروفایل شما کامل نیست؛ لطفاً اطلاعات زیر را تکمیل کنید.', { removeKeyboard: true });
    return askNextProfileField(ctx, missing);
  }
  await send(ctx, '✅ وارد حساب تماس مارکت شدید.', { removeKeyboard: true });
  return showMenu(ctx);
}

/* ------------------------------------------------------------------ *
 * Profile, business licence and identity
 * ------------------------------------------------------------------ */

function profileBody(user: UserRow): ProfileWrite {
  return {
    name: user.name ?? '',
    lastName: user.lastName ?? '',
    storeName: user.storeName ?? '',
    landline: user.landline ?? '',
    address: user.address ?? '',
    postalCode: user.postalCode ?? '',
    certificateFileUrl: user.certificateFileUrl ?? '',
    activity: user.activity ?? '',
    pageWebsite: user.pageWebsite ?? '',
  };
}

async function showProfile(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  const value = (field: BotProfileField) => escapeHtml(String(user[field] ?? '').trim() || '—');
  const text = [
    '<b>👤 حساب تماس مارکت</b>',
    '',
    ...BOT_PROFILE_FIELDS.map((field) => `${BOT_PROFILE_LABELS[field]}: ${value(field)}`),
    `موبایل: <code>${escapeHtml(user.phone)}</code>`,
    `جواز کسب: ${user.certificateFileUrl ? 'ارسال شده ✅' : 'ارسال نشده'}`,
    `احراز هویت: ${user.isVerifiedIdentity ? 'تأییدشده ✅' : 'انجام نشده'}`,
    `وضعیت حساب: ${user.isActive ? 'فعال ✅' : 'در انتظار تأیید ⏳'}`,
  ].join('\n');
  const edit = BOT_PROFILE_FIELDS.map((field) => btn(`✏️ ${BOT_PROFILE_LABELS[field]}`, `pe:${field}`));
  return send(ctx, text, {
    buttons: [
      edit.slice(0, 2), edit.slice(2, 4), edit.slice(4, 6),
      [btn('📄 ارسال جواز کسب', 'cert'), btn('🪪 احراز هویت', 'id')],
      [btn('🧾 پرونده اعتباری', 'cr')],
      MENU_ROW,
    ],
  });
}

async function completeProfile(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  const missing = profileMissingFields(user);
  if (!missing.length) return send(ctx, '✅ اطلاعات اصلی پروفایل شما کامل است.', { buttons: [[btn('👤 حساب و مدارک', 'pf')], MENU_ROW] });
  return askNextProfileField(ctx, missing);
}

async function askProfileField(ctx: Ctx, field: BotProfileField, queue: BotProfileField[], resume?: 'checkout'): Promise<void> {
  requireUser(ctx);
  if (!BOT_PROFILE_FIELDS.includes(field)) return showProfile(ctx);
  setStep(ctx, { kind: 'profile', field, queue, ...(resume ? { resume } : {}) });
  const optional = field === 'landline' || field === 'postalCode';
  return send(ctx, BOT_PROFILE_PROMPTS[field], { buttons: optional ? [[btn('⏭ رد شدن', 'skip')], CANCEL_ROW] : [CANCEL_ROW] });
}

async function askNextProfileField(ctx: Ctx, queue: BotProfileField[], resume?: 'checkout'): Promise<void> {
  const [next, ...rest] = queue;
  if (next) return askProfileField(ctx, next, rest, resume);
  setStep(ctx, undefined);
  const user = requireUser(ctx);
  const missing = profileMissingFields(user);
  if (missing.length) return askNextProfileField(ctx, missing, resume);
  if (resume === 'checkout' && user.isActive) {
    await send(ctx, '✅ پروفایل شما ذخیره شد. ادامه ثبت سفارش:');
    return startCheckout(ctx);
  }
  await send(ctx, user.isActive
    ? '✅ پروفایل شما ذخیره شد.'
    : '✅ پروفایل شما کامل شد. حساب همکاری پس از بررسی کارشناسان فعال می‌شود؛ تا آن زمان می‌توانید جواز کسب را بفرستید و احراز هویت را انجام دهید.');
  return showProfile(ctx);
}

async function saveProfileAnswer(ctx: Ctx, field: BotProfileField, queue: BotProfileField[], text: string, resume?: 'checkout'): Promise<void> {
  const user = requireUser(ctx);
  const value = text === '-' ? '' : text;
  if (['name', 'lastName', 'storeName', 'address'].includes(field) && value.length < 2) {
    return send(ctx, `${BOT_PROFILE_LABELS[field]} نمی‌تواند خالی باشد. دوباره بنویسید:`, { buttons: [CANCEL_ROW] });
  }
  const parsed = profileWriteSchema.safeParse({ ...profileBody(user), [field]: value });
  if (!parsed.success) return send(ctx, `${BOT_PROFILE_LABELS[field]} بیش از حد طولانی است. کوتاه‌تر بنویسید:`, { buttons: [CANCEL_ROW] });
  await ctx.deps.profile.save(user, parsed.data);
  ctx.user = { ...user, [field]: parsed.data[field] };
  return askNextProfileField(ctx, queue, resume);
}

async function askCertificate(ctx: Ctx): Promise<void> {
  requireUser(ctx);
  setStep(ctx, { kind: 'certificate' });
  return send(ctx, '📄 تصویر یا PDF جواز کسب (یا مجوز فعالیت) فروشگاه را بفرستید.', { buttons: [CANCEL_ROW] });
}

async function askIdentity(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  if (user.isVerifiedIdentity) return send(ctx, '✅ هویت شما قبلاً تأیید شده است.', { buttons: [[btn('👤 حساب و مدارک', 'pf')], MENU_ROW] });
  setStep(ctx, { kind: 'identity_code' });
  return send(ctx, '🪪 <b>احراز هویت</b>\n\nکد ملی ۱۰ رقمی صاحب حساب را بنویسید:', { buttons: [CANCEL_ROW] });
}

async function verifyIdentity(ctx: Ctx, nationalCode: string, birthDate: string): Promise<void> {
  const user = requireUser(ctx);
  setStep(ctx, undefined);
  const result = await ctx.deps.profile.verifyIdentity(user, nationalCode, birthDate);
  ctx.user = { ...user, nationalCode, isVerifiedIdentity: true };
  return send(ctx, `✅ ${escapeHtml(result.message)}`, { buttons: [[btn('👤 حساب و مدارک', 'pf')], MENU_ROW] });
}

/* ------------------------------------------------------------------ *
 * Catalog
 * ------------------------------------------------------------------ */

async function showCategories(ctx: Ctx): Promise<void> {
  const categories = (await ctx.deps.catalog.categories()).filter((category) => (category.productCount ?? 1) > 0).slice(0, 40);
  const buttons: BotButtons = [];
  for (let index = 0; index < categories.length; index += 2) {
    buttons.push(categories.slice(index, index + 2).map((category) => btn(category.faName || category.name, `c:${category.id}`)));
  }
  buttons.push([btn('🔎 جستجو', 's'), btn('🔥 بلک فرایدی', 'bf')], MENU_ROW);
  return send(ctx, '<b>🛍 دسته‌بندی محصولات</b>\n\nیک دسته را انتخاب کنید یا نام کالا را بنویسید.', { buttons });
}

async function showCategory(ctx: Ctx, id: number): Promise<void> {
  const category = (await ctx.deps.catalog.categories()).find((item) => item.id === id);
  if (!category) return showCategories(ctx);
  return startBrowse(ctx, { category: category.name, page: 1 });
}

async function startBrowse(ctx: Ctx, browse: NonNullable<BotSession['browse']>): Promise<void> {
  ctx.session.browse = browse;
  ctx.dirty = true;
  return showBrowsePage(ctx, browse.page);
}

async function showBrowsePage(ctx: Ctx, page: number): Promise<void> {
  const browse = { ...(ctx.session.browse ?? { page: 1 }), page };
  ctx.session.browse = browse;
  ctx.dirty = true;
  const result = await ctx.deps.catalog.search({
    q: browse.q, category: browse.category, blackFriday: browse.blackFriday, page, perPage: BOT_PAGE_SIZE,
  });
  const title = browse.q ? `نتایج «${escapeHtml(browse.q)}»` : browse.blackFriday ? '🔥 ویژه بلک فرایدی (فقط نقدی)' : browse.category ? escapeHtml(browse.category) : 'محصولات';
  if (!result.groups.length) {
    return send(ctx, `${title}\n\nکالایی پیدا نشد. نام دیگری را امتحان کنید.`, { buttons: [[btn('🛍 دسته‌بندی‌ها', 'cat'), btn('🔎 جستجو', 's')], MENU_ROW] });
  }
  const pages = Math.max(1, Math.ceil(result.total / BOT_PAGE_SIZE));
  const showPrice = canSeePrices(ctx);
  const buttons: BotButtons = result.groups.map((group) => {
    const first = group.variants[0];
    const label = `${group.title.slice(0, 42)}${showPrice && group.minPrice > 0 ? ` — ${money(group.minPrice)}` : ''}`;
    return [first ? btn(label, `p:${productRef(first.id)}`) : btn(label, 'cat')];
  });
  const nav: BotButton[] = [];
  if (page > 1) nav.push(btn('◀️ قبلی', `pg:${page - 1}`));
  if (page < pages) nav.push(btn('بعدی ▶️', `pg:${page + 1}`));
  if (nav.length) buttons.push(nav);
  buttons.push([btn('🛒 سبد خرید', 'cart'), btn('🛍 دسته‌بندی‌ها', 'cat')], MENU_ROW);
  const priceNote = showPrice ? '' : '\n🔒 قیمت‌ها پس از ورود و تأیید حساب همکاری نمایش داده می‌شوند.';
  return send(ctx, `<b>${title}</b>\n${faNumber(result.total)} مدل — صفحه ${faNumber(page)} از ${faNumber(pages)}${priceNote}\n\nروی کالا بزنید تا رنگ‌ها و موجودی را ببینید.`, { buttons });
}

function absoluteUrl(siteUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return path;
  if (!path.startsWith('/')) return null;
  return `${siteUrl.replace(/\/$/, '')}${path}`;
}

async function showProduct(ctx: Ctx, ref: string): Promise<void> {
  const lookup = productLookupId(ref);
  const found = lookup ? await ctx.deps.catalog.product(lookup) : null;
  if (!found) return send(ctx, 'این کالا دیگر در فروشگاه نیست.', { buttons: [[btn('🛍 محصولات', 'cat')], MENU_ROW] });
  const { product, variants } = found;
  const all = variants.length ? variants : [product];
  const text = formatProduct(product, all, canSeePrices(ctx));
  const buttons: BotButtons = [];
  if (ctx.user?.isActive) {
    for (const variant of all) {
      for (const warehouse of orderableWarehouses(variant)) {
        if (buttons.length >= 12) break;
        buttons.push([btn(`➕ ${(variant.color || 'افزودن').slice(0, 24)} · ${warehouseLabel(warehouse)}`, `a:${productRef(variant.id)}:${warehouseCode(warehouse)}`)]);
      }
    }
    if (!buttons.length) buttons.push([btn('ناموجود — بازگشت به فهرست', `pg:${ctx.session.browse?.page ?? 1}`)]);
  } else if (ctx.user) {
    buttons.push([btn('⏳ حساب در انتظار تأیید', 'pf')]);
  } else {
    buttons.push([btn('🔑 ورود برای دیدن قیمت و خرید', 'login')]);
  }
  buttons.push([btn('🛒 سبد خرید', 'cart'), btn('↩️ فهرست', `pg:${ctx.session.browse?.page ?? 1}`)]);
  buttons.push([{ text: '🌐 مشاهده در سایت', url: `${ctx.channel.siteUrl.replace(/\/$/, '')}/p/${encodeURIComponent(product.productId)}` }]);
  const photo = absoluteUrl(ctx.channel.siteUrl, product.imageUrl);
  if (photo && ctx.channel.transport.sendPhoto && text.length <= 1000) {
    try {
      await ctx.channel.transport.sendPhoto(ctx.input.chatId, photo, text, { buttons });
      return;
    } catch {
      // An image the platform cannot fetch must not hide the product.
    }
  }
  return send(ctx, text, { buttons });
}

/* ------------------------------------------------------------------ *
 * Cart
 * ------------------------------------------------------------------ */

async function addToCart(ctx: Ctx, ref: string, code: string | undefined, qty: number): Promise<void> {
  const user = requireActiveUser(ctx);
  const warehouse = warehouseFromCode(code);
  const lookup = productLookupId(ref);
  const found = lookup && warehouse ? await ctx.deps.catalog.product(lookup) : null;
  if (!found || !warehouse) return send(ctx, 'این کالا دیگر در فروشگاه نیست.', { buttons: [MENU_ROW] });
  const product = found.product;
  if (!orderableWarehouses(product).includes(warehouse)) {
    return send(ctx, `موجودی «${escapeHtml(product.title)}» در ${warehouseLabel(warehouse)} تمام شده است.`, { buttons: [[btn('↩️ مشاهده کالا', `p:${ref}`)], MENU_ROW] });
  }
  const amount = Number.isSafeInteger(qty) && qty > 0 ? Math.min(qty, 10_000) : 1;
  const lines = await ctx.deps.cart.get(user.id);
  const result = addCartLine(lines, product, warehouse, amount);
  await ctx.deps.cart.save(user.id, result.lines);
  const head = result.added > 0
    ? `✅ ${faNumber(result.added)} عدد «${escapeHtml(product.title)}${product.color ? ` (${escapeHtml(product.color)})` : ''}» به سبد اضافه شد.`
    : `موجودی بیشتری از «${escapeHtml(product.title)}» در ${warehouseLabel(warehouse)} نیست.`;
  const base = `${ref}:${code}`;
  return send(ctx, `${head}\nتعداد در سبد: <b>${faNumber(result.line.qty)}</b> از ${faNumber(result.line.maxStock)} موجود`, {
    buttons: [
      [btn('➕ ۱', `a:${base}:1`), btn('➕ ۵', `a:${base}:5`), btn('➕ ۱۰', `a:${base}:10`), btn('✏️ تعداد', `q:${base}`)],
      [btn('🛒 مشاهده سبد و ثبت سفارش', 'cart')],
      [btn('🛍 ادامه خرید', `pg:${ctx.session.browse?.page ?? 1}`), MENU_ROW[0]!],
    ],
  });
}

async function askQuantity(ctx: Ctx, ref: string, code: string | undefined): Promise<void> {
  const user = requireActiveUser(ctx);
  const warehouse = warehouseFromCode(code);
  const lookup = productLookupId(ref);
  const found = lookup && warehouse ? await ctx.deps.catalog.product(lookup) : null;
  if (!found || !warehouse) return showCart(ctx);
  const key = cartKey(found.product.productId, warehouse);
  const lines = await ctx.deps.cart.get(user.id);
  if (!lines.some((line) => line.key === key)) {
    const added = addCartLine(lines, found.product, warehouse, 1);
    await ctx.deps.cart.save(user.id, added.lines);
  }
  setStep(ctx, { kind: 'qty', key });
  return send(ctx, `تعداد «${escapeHtml(found.product.title)}» را بنویسید (حداکثر ${faNumber(Math.max(0, stockIn(found.product, warehouse)))}):`, { buttons: [CANCEL_ROW] });
}

async function setQuantity(ctx: Ctx, key: string, text: string): Promise<void> {
  const user = requireActiveUser(ctx);
  const qty = parseQuantity(text);
  if (!qty) return send(ctx, 'تعداد را به عدد بنویسید (مثلاً ۱۲):', { buttons: [CANCEL_ROW] });
  setStep(ctx, undefined);
  const lines = await ctx.deps.cart.get(user.id);
  if (!lines.some((line) => line.key === key)) return send(ctx, 'این کالا در سبد شما نیست.', { buttons: [[btn('🛒 سبد خرید', 'cart')]] });
  const next = setCartLineQty(lines, key, qty);
  await ctx.deps.cart.save(user.id, next);
  const line = next.find((item) => item.key === key);
  if (line && line.qty < qty) await send(ctx, `موجودی این کالا ${faNumber(line.maxStock)} عدد است؛ همین تعداد در سبد قرار گرفت.`);
  return showCart(ctx);
}

async function showCart(ctx: Ctx): Promise<void> {
  const user = requireActiveUser(ctx);
  const lines = await ctx.deps.cart.get(user.id);
  if (!lines.length) return send(ctx, '🛒 سبد خرید شما خالی است.', { buttons: [[btn('🛍 محصولات', 'cat'), btn('🔎 جستجو', 's')], MENU_ROW] });
  let total = cartTotal(lines);
  let warning = '';
  try {
    total = (await ctx.deps.checkout.quote(lines.map((line) => ({ productId: line.productId, qty: line.qty })))).baseAmount;
  } catch (error) {
    warning = `\n\n⚠️ ${escapeHtml(persianMessage(error))}`;
  }
  const buttons: BotButtons = lines.slice(0, 10).map((line, index) => {
    const n = faNumber(index + 1);
    return [btn(`${n} ➖`, `ci:${index}:-`), btn(`${n} ➕`, `ci:${index}:+`), btn(`${n} 🗑`, `cd:${index}`)];
  });
  buttons.push([btn('✅ ادامه ثبت سفارش', 'co')], [btn('🧹 خالی کردن سبد', 'cc'), btn('🛍 ادامه خرید', 'cat')], MENU_ROW);
  return send(ctx, `${formatCart(lines, total)}${warning}`, { buttons });
}

async function changeCartLine(ctx: Ctx, index: number, change: 1 | -1 | 'remove'): Promise<void> {
  const user = requireActiveUser(ctx);
  const lines = await ctx.deps.cart.get(user.id);
  const line = Number.isSafeInteger(index) ? lines[index] : undefined;
  if (!line) return showCart(ctx);
  const qty = change === 'remove' ? 0 : line.qty + change;
  if (change === 1 && line.maxStock > 0 && qty > line.maxStock) await send(ctx, `موجودی این کالا ${faNumber(line.maxStock)} عدد است.`);
  await ctx.deps.cart.save(user.id, setCartLineQty(lines, line.key, qty));
  return showCart(ctx);
}

async function clearCart(ctx: Ctx): Promise<void> {
  const user = requireActiveUser(ctx);
  await ctx.deps.cart.clear(user.id);
  ctx.session.checkout = undefined;
  ctx.dirty = true;
  return send(ctx, '🧹 سبد خرید خالی شد.', { buttons: [[btn('🛍 محصولات', 'cat')], MENU_ROW] });
}

/* ------------------------------------------------------------------ *
 * Checkout
 * ------------------------------------------------------------------ */

async function checkoutState(ctx: Ctx, user: UserRow): Promise<{ lines: SavedCartLineDTO[]; options: BotPaymentOption[]; message?: string; baseAmount: number }> {
  const lines = await ctx.deps.cart.get(user.id);
  if (!lines.length) throw new BotUserError('سبد خرید شما خالی است.');
  const [quote, methods, wallet] = await Promise.all([
    ctx.deps.checkout.quote(lines.map((line) => ({ productId: line.productId, qty: line.qty }))),
    ctx.deps.checkout.paymentMethods(),
    ctx.deps.checkout.wallet(user.id),
  ]);
  return { lines, options: checkoutPaymentOptions(quote, methods, wallet), message: quote.message, baseAmount: quote.baseAmount };
}

async function startCheckout(ctx: Ctx): Promise<void> {
  const user = requireActiveUser(ctx);
  const missing = profileMissingFields(user);
  if (missing.length) {
    await send(ctx, '📝 برای ثبت سفارش، ابتدا اطلاعات پروفایل را تکمیل کنید.');
    return askNextProfileField(ctx, missing, 'checkout');
  }
  const state = await checkoutState(ctx, user);
  if (!state.options.length) {
    throw new BotUserError(state.message ?? 'هیچ روش تسویه معتبری برای کالاهای این فاکتور فعال نیست.');
  }
  const previous = ctx.session.checkout ?? {};
  ctx.session.checkout = {
    ...previous,
    options: state.options.map((option) => option.id),
    method: state.options.some((option) => option.id === previous.method) ? previous.method : undefined,
  };
  ctx.dirty = true;
  const buttons: BotButtons = state.options.slice(0, 12).map((option, index) => [
    btn(`${ctx.session.checkout?.method === option.id ? '✅ ' : ''}${option.label.slice(0, 34)} — ${money(option.amount)}`, `cm:${index}`),
  ]);
  buttons.push([btn('🛒 بازگشت به سبد', 'cart')], CANCEL_ROW);
  const note = state.message ? `\n\nℹ️ ${escapeHtml(state.message)}` : '';
  return send(ctx, `<b>💳 روش تسویه</b>\n\nجمع کالاها: <b>${money(state.baseAmount)}</b>${note}\n\nروش پرداخت را انتخاب کنید:`, { buttons });
}

async function chooseMethod(ctx: Ctx, index: number): Promise<void> {
  requireActiveUser(ctx);
  const id = ctx.session.checkout?.options?.[index];
  if (!id) return startCheckout(ctx);
  ctx.session.checkout = { ...ctx.session.checkout, method: id };
  ctx.dirty = true;
  return showReview(ctx);
}

async function askCheckout(ctx: Ctx, kind: 'checkout_address' | 'checkout_discount' | 'checkout_note', prompt: string): Promise<void> {
  requireActiveUser(ctx);
  setStep(ctx, { kind });
  const buttons: BotButtons = kind === 'checkout_address' && ctx.user?.address ? [[btn('📍 همان آدرس پروفایل', 'cad')], CANCEL_ROW] : [CANCEL_ROW];
  return send(ctx, prompt, { buttons });
}

async function useProfileAddress(ctx: Ctx): Promise<void> {
  requireActiveUser(ctx);
  setStep(ctx, undefined);
  ctx.session.checkout = { ...ctx.session.checkout, address: undefined };
  return showReview(ctx);
}

async function showReview(ctx: Ctx): Promise<void> {
  const user = requireActiveUser(ctx);
  const state = await checkoutState(ctx, user);
  const draft = ctx.session.checkout ?? {};
  const option = state.options.find((item) => item.id === draft.method);
  if (!option) return startCheckout(ctx);
  const address = draft.address || user.address;
  const schedule = option.plan?.schedule ?? [];
  const lines = [
    '<b>🧾 بازبینی سفارش</b>',
    '',
    `اقلام: ${faNumber(state.lines.length)} کالا، ${faNumber(state.lines.reduce((sum, line) => sum + line.qty, 0))} عدد`,
    `جمع کالاها: ${money(state.baseAmount)}`,
    `روش تسویه: <b>${escapeHtml(option.label)}</b>`,
    `مبلغ قابل پرداخت: <b>${money(option.amount)}</b>${draft.discountCode ? ' (پیش از اعمال کد تخفیف)' : ''}`,
  ];
  if (schedule.length > 1) lines.push(...schedule.slice(0, 6).map((row) => `  • ${escapeHtml(row.dueLabel)}: ${scheduleAmount(row)}`));
  lines.push(`📍 آدرس: ${escapeHtml(address || '— ثبت نشده —')}`);
  if (draft.discountCode) lines.push(`🎟 کد تخفیف: <code>${escapeHtml(draft.discountCode)}</code>`);
  if (draft.note) lines.push(`📝 توضیحات: ${escapeHtml(draft.note)}`);
  lines.push('', 'با ثبت سفارش، قوانین و شرایط فروش تماس مارکت را می‌پذیرید. قیمت و موجودی نهایی هنگام ثبت از سایت خوانده می‌شود.');
  return send(ctx, lines.join('\n'), {
    buttons: [
      [btn('✅ تأیید و ثبت سفارش', 'cok')],
      [btn('📍 تغییر آدرس', 'ca'), btn('🎟 کد تخفیف', 'cdc')],
      [btn('📝 توضیحات', 'cn'), btn('💳 تغییر روش پرداخت', 'co')],
      CANCEL_ROW,
    ],
  });
}

async function placeOrder(ctx: Ctx): Promise<void> {
  const user = requireActiveUser(ctx);
  const state = await checkoutState(ctx, user);
  const draft = ctx.session.checkout ?? {};
  const option = state.options.find((item) => item.id === draft.method);
  if (!option) return startCheckout(ctx);
  const address = (draft.address || user.address || '').trim();
  if (!address) return askCheckout(ctx, 'checkout_address', '📍 آدرس تحویل سفارش را بنویسید:');
  const order = await ctx.deps.checkout.createOrder(user, {
    items: state.lines.map((line) => ({ productId: line.productId, warehouse: line.warehouse, qty: line.qty })),
    address: draft.address || undefined,
    note: draft.note || undefined,
    discountCode: draft.discountCode || undefined,
    ...orderPaymentFields(option),
    attribution: { source: ctx.channel.platform, medium: 'bot' },
  });
  // The cart became an order: no abandoned-cart reminder for it.
  await ctx.deps.cart.clear(user.id).catch(() => undefined);
  ctx.session.checkout = undefined;
  ctx.dirty = true;
  await send(ctx, `✅ <b>سفارش شما با شماره <code>${escapeHtml(order.orderCode)}</code> ثبت شد.</b>`);
  return sendOrder(ctx, order);
}

/* ------------------------------------------------------------------ *
 * Orders, tracking and payment follow-up
 * ------------------------------------------------------------------ */

function orderButtons(order: OrderDTO): BotButtons {
  const rows: BotButtons = [];
  const action = orderPaymentAction(order);
  if (action === 'gateway') rows.push([btn('💳 پرداخت آنلاین', `pay:${order.id}`)]);
  if (action === 'cheque') rows.push([btn('🧾 ثبت اطلاعات چک', `rc:${order.id}`)]);
  if (action === 'receipt') rows.push([btn('🧾 ارسال رسید پرداخت', `rc:${order.id}`)]);
  rows.push([btn('🔄 به‌روزرسانی وضعیت', `od:${order.id}`), btn('📦 سفارش‌های من', 'o')], MENU_ROW);
  return rows;
}

function sendOrder(ctx: Ctx, order: OrderDTO): Promise<void> {
  return send(ctx, formatOrderDetail(order), { buttons: orderButtons(order) });
}

async function ownOrder(ctx: Ctx, match: (order: OrderDTO) => boolean): Promise<OrderDTO | null> {
  const user = requireUser(ctx);
  return (await ctx.deps.orders.list(user.id)).find(match) ?? null;
}

async function showOrders(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  const orders = (await ctx.deps.orders.list(user.id)).slice(0, 8);
  if (!orders.length) return send(ctx, '📦 هنوز سفارشی برای حساب شما ثبت نشده است.', { buttons: [[btn('🛍 محصولات', 'cat')], MENU_ROW] });
  return send(ctx, `<b>📦 آخرین سفارش‌های شما</b>\n\n${orders.map(formatOrderLine).join('\n\n')}\n\nبرای جزئیات و پیگیری روی سفارش بزنید.`, {
    buttons: [...orders.map((order) => [btn(`📦 ${order.orderCode}`, `od:${order.id}`)]), MENU_ROW],
  });
}

async function showOrder(ctx: Ctx, id: number): Promise<void> {
  const order = await ownOrder(ctx, (item) => item.id === id);
  if (!order) return send(ctx, 'این سفارش در حساب شما پیدا نشد.', { buttons: [[btn('📦 سفارش‌های من', 'o')]] });
  return sendOrder(ctx, order);
}

async function askTrack(ctx: Ctx): Promise<void> {
  requireUser(ctx);
  setStep(ctx, { kind: 'track' });
  return send(ctx, '📍 کد سفارش را بفرستید (مثل KP-20261126-101500-123):', { buttons: [[btn('📦 سفارش‌های من', 'o')], CANCEL_ROW] });
}

async function trackOrder(ctx: Ctx, code: string): Promise<void> {
  if (!ctx.user) return send(ctx, 'برای پیگیری سفارش ابتدا وارد حساب خود شوید.', { buttons: [[btn('🔑 ورود / ثبت‌نام', 'login')]] });
  const found = await ctx.deps.orders.byCode(code.toUpperCase());
  const order = found && found.userId === ctx.user.id ? found : null;
  if (!order) return send(ctx, 'سفارشی با این کد در حساب شما پیدا نشد.', { buttons: [[btn('📦 سفارش‌های من', 'o')], MENU_ROW] });
  return sendOrder(ctx, order);
}

async function payOnline(ctx: Ctx, orderId: number): Promise<void> {
  const user = requireUser(ctx);
  const url = await ctx.deps.checkout.gatewayUrl(user.id, orderId);
  return send(ctx, '💳 برای پرداخت امن از درگاه بانکی روی دکمه زیر بزنید. پس از پرداخت، وضعیت سفارش در همین ربات به‌روز می‌شود.', {
    buttons: [[{ text: '💳 ورود به درگاه پرداخت', url }], [btn('🔄 وضعیت سفارش', `od:${orderId}`)]],
  });
}

async function startPaymentInfo(ctx: Ctx, orderId: number): Promise<void> {
  const order = await ownOrder(ctx, (item) => item.id === orderId);
  if (!order) return send(ctx, 'این سفارش در حساب شما پیدا نشد.');
  const action = orderPaymentAction(order);
  if (action === 'cheque') {
    setStep(ctx, { kind: 'cheque_number', orderId });
    return send(ctx, '🧾 شماره صیادی ۱۶ رقمی چک اول را بنویسید:', { buttons: [CANCEL_ROW] });
  }
  if (!action) return sendOrder(ctx, order);
  setStep(ctx, { kind: 'receipt', orderId });
  const instructions = order.paymentInstructions?.status === 'sent' && order.paymentInstructions.instructions
    ? `\n\n${escapeHtml(order.paymentInstructions.instructions)}`
    : '';
  return send(ctx, `🧾 تصویر رسید واریز سفارش <code>${escapeHtml(order.orderCode)}</code> را بفرستید یا شماره پیگیری را بنویسید.${instructions}`, { buttons: [CANCEL_ROW] });
}

async function submitPaymentInfo(
  ctx: Ctx,
  orderId: number,
  info: { refNumber?: string; receiptNote?: string; receiptImageUrl?: string; checkNumber?: string; checkBankName?: string },
): Promise<void> {
  const user = requireUser(ctx);
  const order = await ownOrder(ctx, (item) => item.id === orderId);
  if (!order) return send(ctx, 'این سفارش در حساب شما پیدا نشد.');
  const result = await ctx.deps.checkout.submitPaymentInfo(user.id, { orderId, paymentMethod: order.paymentMethod ?? 'online', ...info });
  if (!result.ok) throw new BotUserError(result.message);
  return send(ctx, `✅ ${escapeHtml(result.message)} پس از بررسی واحد مالی، وضعیت سفارش به‌روز می‌شود.`, { buttons: [[btn('🔄 وضعیت سفارش', `od:${orderId}`)], MENU_ROW] });
}

/* ------------------------------------------------------------------ *
 * Credit application and documents
 * ------------------------------------------------------------------ */

async function showCredit(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  const summary = await ctx.deps.credit.summary(user.id);
  if (!summary) {
    return send(ctx, '<b>🧾 اعتبار خرید</b>\n\nهنوز درخواست اعتباری ثبت نکرده‌اید. با ثبت درخواست و ارسال مدارک، امکان خرید چکی و اعتباری برای شما بررسی می‌شود.', {
      buttons: [[btn('📝 ثبت درخواست اعتبار', 'cra')], MENU_ROW],
    });
  }
  const status = summary.status as CreditStatus;
  const lines = [
    '<b>🧾 پرونده اعتباری</b>',
    '',
    `وضعیت: <b>${escapeHtml(CREDIT_STATUS_LABELS[status] ?? summary.status)}</b>`,
    escapeHtml(CREDIT_STATUS_DESCRIPTIONS[status] ?? ''),
  ];
  if (summary.assignedCreditLimit > 0) lines.push(`سقف اعتبار: ${money(summary.assignedCreditLimit)}`);
  if (summary.rejectionReason) lines.push(`توضیح کارشناس: ${escapeHtml(summary.rejectionReason)}`);
  if (summary.pendingChequeAmount > 0) lines.push(`چک در انتظار: ${money(summary.pendingChequeAmount)}`);
  if (summary.bouncedCheques > 0) lines.push(`⚠️ چک برگشتی: ${faNumber(summary.bouncedCheques)} فقره`);
  const buttons: BotButtons = [];
  if (status !== 'active') buttons.push([btn(status === 'action_required' ? '📝 ارسال دوباره درخواست' : '✏️ به‌روزرسانی مدارک', 'cra')]);
  buttons.push(MENU_ROW);
  return send(ctx, lines.filter(Boolean).join('\n'), { buttons });
}

async function startCreditApplication(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  ctx.session.credit = {};
  ctx.dirty = true;
  if (await ctx.deps.credit.hasFreshReport(user.id)) return askNationalId(ctx);
  setStep(ctx, { kind: 'credit_report' });
  return send(ctx, [
    '<b>📝 درخواست اعتبار — مرحله ۱</b>',
    '',
    'گزارش اعتبارسنجی رسمی خود را از سامانه ICS24 (ics24.ir) دریافت کنید و <b>فایل PDF</b> آن را همین‌جا بفرستید.',
    'کد ملی داخل گزارش باید با کد ملی حساب شما یکی باشد.',
  ].join('\n'), { buttons: [CANCEL_ROW] });
}

async function askNationalId(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  setStep(ctx, { kind: 'credit_national_id' });
  const saved = parseNationalCode(user.nationalCode);
  return send(ctx, '🪪 کد ملی ۱۰ رقمی صاحب کسب‌وکار را بنویسید:', {
    buttons: saved ? [[btn(`استفاده از ${saved}`, 'crn')], CANCEL_ROW] : [CANCEL_ROW],
  });
}

async function useSavedNationalCode(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  const saved = parseNationalCode(user.nationalCode);
  if (!saved) return askNationalId(ctx);
  ctx.session.credit = { ...ctx.session.credit, nationalId: saved };
  return askBusinessType(ctx);
}

async function askBusinessType(ctx: Ctx): Promise<void> {
  setStep(ctx, { kind: 'credit_business' });
  return send(ctx, '🏪 نوع کسب‌وکار خود را انتخاب کنید:', {
    buttons: [...CREDIT_BUSINESS_TYPES.map((type, index) => [btn(type.label, `crb:${index}`)]), CANCEL_ROW],
  });
}

async function chooseBusinessType(ctx: Ctx, index: number): Promise<void> {
  requireUser(ctx);
  const type = CREDIT_BUSINESS_TYPES[index];
  if (!type || ctx.session.step?.kind !== 'credit_business') return askBusinessType(ctx);
  ctx.session.credit = { ...ctx.session.credit, businessType: type.value };
  return askCreditDocument(ctx, CREDIT_DOCUMENT_STEPS[0].field);
}

async function askCreditDocument(ctx: Ctx, field: CreditDocumentField): Promise<void> {
  const step = CREDIT_DOCUMENT_STEPS.find((item) => item.field === field)!;
  setStep(ctx, { kind: 'credit_document', field });
  return send(ctx, step.prompt, { buttons: step.optional ? [[btn('⏭ رد شدن', 'skip')], CANCEL_ROW] : [CANCEL_ROW] });
}

async function askNextCreditDocument(ctx: Ctx, current: CreditDocumentField): Promise<void> {
  const index = CREDIT_DOCUMENT_STEPS.findIndex((item) => item.field === current);
  const step = CREDIT_DOCUMENT_STEPS[index];
  if (step && !step.optional && !ctx.session.credit?.[current]) return askCreditDocument(ctx, current);
  const next = CREDIT_DOCUMENT_STEPS[index + 1];
  if (next) return askCreditDocument(ctx, next.field);
  setStep(ctx, { kind: 'credit_referral' });
  return send(ctx, '👥 اگر کسی شما را معرفی کرده یا توضیحی دارید بنویسید (اختیاری):', { buttons: [[btn('⏭ رد شدن', 'skip')], CANCEL_ROW] });
}

async function reviewCredit(ctx: Ctx): Promise<void> {
  setStep(ctx, undefined);
  const draft = ctx.session.credit ?? {};
  const done = (value: string | undefined) => (value ? '✅' : '—');
  return send(ctx, [
    '<b>📝 بازبینی درخواست اعتبار</b>',
    '',
    `کد ملی: <code>${escapeHtml(draft.nationalId ?? '—')}</code>`,
    `نوع کسب‌وکار: ${escapeHtml(draft.businessType ?? '—')}`,
    `کارت ملی: ${done(draft.nationalCardUrl)}`,
    `جواز کسب / اجاره‌نامه: ${done(draft.businessDocsUrl)}`,
    `برگ چک صیادی: ${done(draft.checkImageUrl)}`,
    `گردش حساب: ${done(draft.bankStatementUrl)}`,
    draft.referralInfo ? `توضیحات: ${escapeHtml(draft.referralInfo)}` : '',
  ].filter(Boolean).join('\n'), { buttons: [[btn('✅ ارسال درخواست', 'crok')], CANCEL_ROW] });
}

async function submitCredit(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  const parsed = creditApplicationWriteSchema.safeParse({
    ...ctx.session.credit,
    bankStatementUrl: ctx.session.credit?.bankStatementUrl ?? null,
    referralInfo: ctx.session.credit?.referralInfo ?? null,
  });
  if (!parsed.success) {
    return send(ctx, `بخشی از درخواست ناقص است: ${escapeHtml(parsed.error.issues[0]?.message ?? '')}`, { buttons: [[btn('📝 شروع دوباره', 'cra')], MENU_ROW] });
  }
  const result = await ctx.deps.credit.submit(user, parsed.data);
  ctx.session.credit = undefined;
  ctx.dirty = true;
  const status = result.status as CreditStatus;
  return send(ctx, `✅ درخواست اعتبار شما ثبت شد.\nوضعیت: <b>${escapeHtml(CREDIT_STATUS_LABELS[status] ?? result.status)}</b>\n${escapeHtml(CREDIT_STATUS_DESCRIPTIONS[status] ?? '')}`, { buttons: [[btn('🧾 پرونده اعتباری', 'cr')], MENU_ROW] });
}

/* ------------------------------------------------------------------ *
 * Wallet
 * ------------------------------------------------------------------ */

async function showWallet(ctx: Ctx): Promise<void> {
  const user = requireUser(ctx);
  const wallet = await ctx.deps.wallet.summary(user.id);
  if (!wallet) return send(ctx, '💳 هنوز کیف پولی برای حساب شما ایجاد نشده است.', { buttons: [MENU_ROW] });
  return send(ctx, `<b>💳 کیف پول شما</b>\n\nموجودی: <b>${money(wallet.balance)}</b>\nمجموع واریز: ${money(wallet.lifetimeCredit)}\nمجموع برداشت: ${money(wallet.lifetimeDebit)}${wallet.isFrozen ? '\n\n⚠️ کیف پول مسدود است.' : ''}`, {
    buttons: [[{ text: '➕ شارژ کیف پول در سایت', url: `${ctx.channel.siteUrl.replace(/\/$/, '')}/account` }], MENU_ROW],
  });
}
