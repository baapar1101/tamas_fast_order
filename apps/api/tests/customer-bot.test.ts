import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BLACK_FRIDAY_RIBBON,
  type OrderCreate,
  type OrderDTO,
  type PaymentPlanQuote,
  type ProductDTO,
  type SavedCartLineDTO,
} from '@tamas/shared';
import type { UserRow } from '../src/services/auth.js';
import type { CartPaymentQuote } from '../src/services/cart-quote.js';
import {
  BOT_CALLBACK_PREFIX,
  handleCustomerBotInput,
  type BotButtons,
  type BotChannel,
  type BotIncoming,
  type BotSendOptions,
  type CustomerBotDeps,
} from '../src/services/customer-bot.js';
import {
  DEFAULT_BOT_PAYMENT_METHODS,
  addCartLine,
  checkoutPaymentOptions,
  findOrderCode,
  orderPaymentAction,
  orderableWarehouses,
  parseBotPaymentMethods,
  parseMobile,
  productLookupId,
  productRef,
  type BotSession,
} from '../src/services/customer-bot-model.js';
import { toTelegramBotIncoming } from '../src/services/customer-telegram.js';
import { baleText, toBaleBotIncoming } from '../src/services/customer-bale.js';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

function product(id: number, overrides: Partial<ProductDTO> = {}): ProductDTO {
  return {
    id, productId: `P-${id}`, sku: null, title: `قاب گوشی ${id}`, model: null, categoryName: 'Case', categoryFaName: 'قاب',
    brandName: null, brandFaName: null, parentProductId: null, otherStocks: {}, color: 'مشکی', colorEn: null, colorCode: null,
    price: 100_000, oldPrice: null, discount: null, stock: 0, kermanStock: 5, tehranStock: 0, warranty: null, sellType: null,
    seller: null, promotion: false, campaignPoints: 0, status: 'active', subTitle: null, description: null, keywords: null,
    slug: null, ribbon: null, type: 'simple', weight: null, dimensions: null, tracking: null, imageUrl: null, gallery: [],
    attributes: [], rating: null, ratingCount: null, externalDataUpdatedAt: null, bundleItems: [], sortOrder: 0,
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  } as ProductDTO;
}

function user(id: number, overrides: Partial<UserRow> = {}): UserRow {
  return {
    id, phone: '09120000000', name: 'علی', lastName: 'رضایی', storeName: 'موبایل علی', landline: '', address: 'کرمان، خیابان شریعتی، پلاک ۱۰',
    postalCode: '', certificateFileUrl: '', activity: '', pageWebsite: '', nationalCode: '', birthDate: '', fatherName: '',
    isVerifiedIdentity: false, isActive: true, role: 'customer', accessGroupId: null, passwordHash: null, deletedAt: null,
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as UserRow;
}

function plan(id: string, kind: PaymentPlanQuote['kind'], amount: number, extra: Partial<PaymentPlanQuote> = {}): PaymentPlanQuote {
  return {
    id, label: kind === 'cash' ? 'نقدی' : kind === 'cheque' ? 'چکی دو ماهه' : 'روزشمار', description: '', audience: 'accessory', kind,
    baseAmount: amount, finalAmount: amount, adjustmentAmount: 0, discountPercent: 0, serviceFeePercent: 0,
    upfrontPercent: null, upfrontAmount: null, schedule: [], instructions: '', requiresPaymentInfo: kind !== 'cash',
    termMonths: null, installmentIntervalMonths: null, settlementDays: null,
    ...extra,
  };
}

function orderFrom(id: number, userId: number, input: OrderCreate, products: Map<string, ProductDTO>): OrderDTO {
  const items = input.items.map((item, index) => {
    const row = products.get(item.productId)!;
    return { id: index + 1, productId: item.productId, sku: null, title: row.title, color: row.color, price: row.price, qty: item.qty, warehouse: item.warehouse };
  });
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return {
    id, orderCode: `KP-20261126-1015${String(id).padStart(2, '0')}-123`, userId, customerName: 'علی رضایی', phone: '09120000000',
    storeName: 'موبایل علی', address: input.address ?? 'کرمان', total, subtotal: total, quantity: 1, status: 'new', paymentStatus: 'unpaid',
    paymentMethod: input.paymentMethod ?? null, paymentPlan: input.paymentPlanId ? plan(input.paymentPlanId, input.paymentPlanId.includes('cheque') ? 'cheque' : 'cash', total) : null,
    discountCode: null, discountAmount: 0, freeShipping: false, paymentInstructions: null, note: input.note ?? null,
    items, createdAt: '2026-11-26T10:15:00.000Z', updatedAt: '2026-11-26T10:15:00.000Z',
  } as OrderDTO;
}

interface Sent { text: string; options?: BotSendOptions }

/** An in-memory shop: every dependency of the engine, recording what the bot asked of it. */
function createShop(options: { users?: UserRow[]; products?: ProductDTO[]; quote?: (items: Array<{ productId: string; qty: number }>) => CartPaymentQuote } = {}) {
  const users = new Map((options.users ?? []).map((row) => [row.id, row]));
  const products = new Map((options.products ?? [product(1)]).map((row) => [row.productId, row]));
  const carts = new Map<number, SavedCartLineDTO[]>();
  const sessions = new Map<string, string>();
  const orders: OrderDTO[] = [];
  const calls = {
    otpSent: [] as string[],
    createdOrders: [] as OrderCreate[],
    profiles: [] as Array<{ userId: number; body: Record<string, string> }>,
    uploads: [] as Array<{ userId: number; scope: string; mimeType: string }>,
    reports: 0,
    credit: [] as unknown[],
    paymentInfo: [] as unknown[],
  };
  let freshReport = false;
  let nextUserId = 100;

  const defaultQuote = (items: Array<{ productId: string; qty: number }>): CartPaymentQuote => {
    const base = items.reduce((sum, item) => sum + (products.get(item.productId)?.price ?? 0) * item.qty, 0);
    const blackFriday = items.some((item) => products.get(item.productId)?.ribbon === BLACK_FRIDAY_RIBBON);
    const plans = blackFriday
      ? [plan('accessory-cash', 'cash', base)]
      : [plan('accessory-cash', 'cash', base), plan('accessory-cheque-2', 'cheque', Math.round(base * 1.05))];
    return {
      audience: 'accessory', baseAmount: base, plans, partitions: [],
      ...(blackFriday ? { enforcedSettlement: true, settlementPolicy: 'cash_only' as const, message: 'سفارش دارای کالای ویژه بلک فرایدی فقط نقدی تسویه می‌شود.' } : {}),
    };
  };

  const deps: CustomerBotDeps = {
    sessions: {
      async load(platform, botUserId) {
        const raw = sessions.get(`${platform}:${botUserId}`);
        return raw ? JSON.parse(raw) as BotSession : {};
      },
      async save(platform, botUserId, _chatId, session) {
        sessions.set(`${platform}:${botUserId}`, JSON.stringify(session));
      },
    },
    users: {
      byId: async (id) => users.get(id) ?? null,
      byPhone: async (phone) => [...users.values()].find((row) => row.phone === phone) ?? null,
      async findOrCreate(phone) {
        const existing = [...users.values()].find((row) => row.phone === phone);
        if (existing) return { row: existing, isNew: false };
        const created = user(nextUserId++, { phone, name: '', lastName: '', storeName: '', address: '', isActive: false });
        users.set(created.id, created);
        return { row: created, isNew: true };
      },
    },
    otp: {
      async send(phone) { calls.otpSent.push(phone); },
      verify: async (_phone, code) => code === '12345',
    },
    catalog: {
      categories: async () => [{ id: 3, name: 'Case', faName: 'قاب', iconUrl: null, sortOrder: 0, brandNames: [], productCount: products.size }],
      async search(query) {
        const rows = [...products.values()].filter((row) => (!query.q || row.title.includes(query.q))
          && (!query.blackFriday || row.ribbon === BLACK_FRIDAY_RIBBON)
          && (!query.category || row.categoryName === query.category));
        return {
          groups: rows.map((row) => ({ key: row.title, title: row.title, imageUrl: null, promotion: false, minPrice: row.price, variants: [row] })),
          total: rows.length, page: query.page ?? 1, perPage: query.perPage ?? 8,
        };
      },
      async product(lookupId) {
        const row = [...products.values()].find((item) => `~${productRef(item.id)}` === lookupId);
        return row ? { product: row, variants: [row] } : null;
      },
    },
    cart: {
      get: async (userId) => structuredClone(carts.get(userId) ?? []),
      async save(userId, lines) { carts.set(userId, structuredClone(lines)); },
      async clear(userId) { carts.delete(userId); },
    },
    checkout: {
      quote: async (items) => (options.quote ?? defaultQuote)(items),
      paymentMethods: async () => DEFAULT_BOT_PAYMENT_METHODS,
      wallet: async () => ({ enabled: true, orderPaymentEnabled: true, isFrozen: false, balance: 10_000_000 }),
      async createOrder(row, input) {
        calls.createdOrders.push(input);
        const order = orderFrom(orders.length + 1, row.id, input, products);
        orders.push(order);
        return order;
      },
      gatewayUrl: async (_userId, orderId) => `https://pay.example/${orderId}`,
      async submitPaymentInfo(userId, body) {
        calls.paymentInfo.push({ userId, ...body });
        return { ok: true, message: 'اطلاعات پرداخت با موفقیت ثبت شد.' };
      },
    },
    orders: {
      list: async (userId) => orders.filter((order) => order.userId === userId),
      byCode: async (orderCode) => orders.find((order) => order.orderCode === orderCode) ?? null,
    },
    profile: {
      async save(row, body) {
        calls.profiles.push({ userId: row.id, body: { ...body } });
        const updated = { ...row, ...body };
        users.set(row.id, updated);
        const missing = ['name', 'lastName', 'storeName', 'address'].filter((field) => !String((updated as Record<string, unknown>)[field] ?? '').trim());
        return { complete: missing.length === 0, missing };
      },
      async verifyIdentity(row, nationalCode) {
        users.set(row.id, { ...row, nationalCode, isVerifiedIdentity: true });
        return { message: 'استعلام اطلاعات هویتی با موفقیت انجام شد.' };
      },
    },
    credit: {
      summary: async () => null,
      hasFreshReport: async () => freshReport,
      async storeReport() {
        calls.reports++;
        freshReport = true;
        return { message: 'گزارش با موفقیت خوانده و در پرونده شما ذخیره شد.' };
      },
      async submit(_row, body) {
        calls.credit.push(body);
        return { status: 'pending' };
      },
    },
    wallet: {
      summary: async () => ({ balance: 250_000, lifetimeCredit: 500_000, lifetimeDebit: 250_000, isFrozen: false }),
    },
    uploads: {
      async store(userId, file, scope) {
        calls.uploads.push({ userId, scope, mimeType: file.mimeType });
        return `/api/private-files/${calls.uploads.length}`;
      },
    },
  };
  return { deps, users, products, carts, orders, calls };
}

/** One Telegram-like chat with the bot. */
function createChat(shop: ReturnType<typeof createShop>, botUserId = '777', linkedTo: number | null = null) {
  let linked = linkedTo;
  const sent: Sent[] = [];
  const channel: BotChannel = {
    platform: 'telegram',
    siteUrl: 'https://tamasmarket.com',
    transport: {
      async send(_chatId, text, options) { sent.push({ text, options }); },
      async download() { return { buffer: Buffer.from('%PDF-1.4 test'), mimeType: 'application/pdf' }; },
    },
    linkedUserId: async () => linked,
    link: async (userId) => { linked = userId; },
  };
  const base = { botUserId, chatId: botUserId };
  const run = async (input: Omit<BotIncoming, 'botUserId' | 'chatId'>) => {
    const from = sent.length;
    await handleCustomerBotInput(channel, { ...base, ...input }, shop.deps);
    return sent.slice(from);
  };
  return {
    sent,
    get linked() { return linked; },
    say: (text: string) => run({ text }),
    tap: (data: string) => run({ callbackData: data.startsWith(BOT_CALLBACK_PREFIX) ? data : `${BOT_CALLBACK_PREFIX}${data}` }),
    contact: (phone: string) => run({ ownContactPhone: phone }),
    upload: (file: { photo: boolean; mimeType?: string; fileName?: string }) => run({ file: { fileId: 'file-1', ...file } }),
    last: () => sent[sent.length - 1]!,
  };
}

function buttonData(buttons: BotButtons | undefined): string[] {
  return (buttons ?? []).flat().map((button) => button.data ?? button.url ?? '');
}

function findButton(message: Sent, label: string): string {
  const button = (message.options?.buttons ?? []).flat().find((item) => item.text.includes(label));
  assert.ok(button?.data, `button «${label}» not found in: ${JSON.stringify(message.options?.buttons)}`);
  return button.data;
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

test('Black Friday cart offers only the cash plan: no wallet, weekly credit or other methods', () => {
  const quote = { baseAmount: 1_000_000, plans: [plan('accessory-cash', 'cash', 1_000_000)], enforcedSettlement: true };
  const wallet = { enabled: true, orderPaymentEnabled: true, isFrozen: false, balance: 50_000_000 };
  const options = checkoutPaymentOptions(quote, DEFAULT_BOT_PAYMENT_METHODS, wallet);
  assert.deepEqual(options.map((option) => option.id), ['accessory-cash']);
});

test('regular cart offers plans plus wallet, gateway and weekly credit, like the storefront', () => {
  const quote = { baseAmount: 1_000_000, plans: [plan('accessory-cash', 'cash', 1_000_000), plan('accessory-cheque-2', 'cheque', 1_050_000)] };
  const rich = checkoutPaymentOptions(quote, DEFAULT_BOT_PAYMENT_METHODS, { enabled: true, orderPaymentEnabled: true, isFrozen: false, balance: 2_000_000 });
  assert.deepEqual(rich.map((option) => option.id), ['accessory-cash', 'accessory-cheque-2', 'wallet', 'aqayepardakht', 'credit_weekly']);
  const poor = checkoutPaymentOptions(quote, DEFAULT_BOT_PAYMENT_METHODS, { enabled: true, orderPaymentEnabled: true, isFrozen: false, balance: 10 });
  assert.ok(!poor.some((option) => option.id === 'wallet'), 'wallet needs enough balance');
  const noPlans = checkoutPaymentOptions({ baseAmount: 500_000, plans: [] }, DEFAULT_BOT_PAYMENT_METHODS, null);
  assert.deepEqual(noPlans.map((option) => option.id), ['aqayepardakht', 'online', 'credit_weekly', 'check_2_month', 'check_4_month']);
});

test('payment methods setting is read like the storefront and always includes the wallet', () => {
  const methods = parseBotPaymentMethods(JSON.stringify([{ id: 'aqayepardakht', label: 'درگاه', enabled: true }, { id: 'online', label: 'کارت', enabled: false }]));
  assert.deepEqual(methods.map((method) => method.id), ['wallet', 'aqayepardakht', 'online']);
  assert.equal(methods[2]!.enabled, false);
  assert.equal(parseBotPaymentMethods('not json'), DEFAULT_BOT_PAYMENT_METHODS);
});

test('parsing: Persian phone numbers, order codes and short product references', () => {
  assert.equal(parseMobile('۰۹۱۲ ۳۴۵ ۶۷۸۹'), '09123456789');
  assert.equal(parseMobile('+989123456789'), '09123456789');
  assert.equal(parseMobile('سلام'), null);
  assert.equal(findOrderCode('پیگیری kp-20261126-101500-123 لطفا'), 'KP-20261126-101500-123');
  assert.equal(productLookupId(productRef(12345)), `~${(12345).toString(36)}`);
  assert.equal(productLookupId('../etc'), null);
});

test('cart never holds more than the warehouse stock, and stockless variants cannot be ordered', () => {
  const item = product(1, { kermanStock: 3 });
  const first = addCartLine([], item, 'kerman', 2);
  const second = addCartLine(first.lines, item, 'kerman', 5);
  assert.equal(second.line.qty, 3);
  assert.equal(second.added, 1);
  assert.deepEqual(orderableWarehouses(product(2, { kermanStock: 0, tehranStock: 0, stock: 0 })), []);
  assert.deepEqual(orderableWarehouses(product(3, { kermanStock: 0, tehranStock: 0, stock: 4 })), ['site']);
});

test('unpaid orders get the follow-up their payment method needs', () => {
  const base = { status: 'new' as const, paymentStatus: 'unpaid' as const, paymentPlan: null };
  assert.equal(orderPaymentAction({ ...base, paymentMethod: 'aqayepardakht' }), 'gateway');
  assert.equal(orderPaymentAction({ ...base, paymentMethod: 'online' }), 'receipt');
  assert.equal(orderPaymentAction({ ...base, paymentMethod: 'wallet' }), null);
  assert.equal(orderPaymentAction({ ...base, paymentMethod: 'x', paymentPlan: plan('c', 'cheque', 1) }), 'cheque');
  assert.equal(orderPaymentAction({ ...base, paymentStatus: 'paid', paymentMethod: 'aqayepardakht' }), null);
});

/* ------------------------------------------------------------------ *
 * Conversations
 * ------------------------------------------------------------------ */

test('guests browse and search the catalog without seeing prices', async () => {
  const shop = createShop({ products: [product(1, { price: 123_456 })] });
  const chat = createChat(shop);
  const [menu] = await chat.say('/start');
  assert.ok(buttonData(menu!.options?.buttons).includes(`${BOT_CALLBACK_PREFIX}login`));
  const [list] = await chat.say('قاب');
  assert.match(list!.text, /نتایج/);
  assert.ok(!(list!.options?.buttons ?? []).flat().some((button) => button.text.includes('تومان')), 'no price on buttons');
  const [detail] = await chat.tap(findButton(list!, 'قاب گوشی 1'));
  assert.ok(!detail!.text.includes('۱۲۳٬۴۵۶'), 'no price in product text');
  assert.match(detail!.text, /پس از ورود/);
  const added = await chat.tap(`a:${productRef(1)}:k`);
  assert.match(added[0]!.text, /وارد حساب/);
});

test('sign-up: phone, SMS code, linked account and profile questions in order', async () => {
  const shop = createShop();
  const chat = createChat(shop);
  await chat.tap('login');
  const [codePrompt] = await chat.say('۰۹۳۵۱۱۱۲۲۳۳');
  assert.deepEqual(shop.calls.otpSent, ['09351112233']);
  assert.match(codePrompt!.text, /کد تأیید/);
  const [wrong] = await chat.say('99999');
  assert.match(wrong!.text, /صحیح نیست/);
  assert.equal(chat.linked, null);

  const afterCode = await chat.say('12345');
  assert.ok(chat.linked, 'bot user is linked to the new account');
  assert.match(afterCode[0]!.text, /ثبت‌نام شما/);
  assert.match(afterCode[1]!.text, /نام خود/);
  await chat.say('مریم');
  await chat.say('احمدی');
  await chat.say('لوازم جانبی مریم');
  const done = await chat.say('تهران، خیابان آزادی، پلاک ۵');
  const saved = shop.users.get(chat.linked!)!;
  assert.equal(saved.name, 'مریم');
  assert.equal(saved.storeName, 'لوازم جانبی مریم');
  assert.equal(saved.address, 'تهران، خیابان آزادی، پلاک ۵');
  assert.match(done[0]!.text, /پس از بررسی کارشناسان/);
  // Required fields only: optional ones were not asked.
  assert.equal(shop.calls.profiles.length, 4);
});

test('a shared contact of an existing customer links without an SMS code', async () => {
  const shop = createShop({ users: [user(5, { phone: '09121234567' })] });
  const chat = createChat(shop);
  await chat.contact('09121234567');
  assert.equal(chat.linked, 5);
  assert.equal(shop.calls.otpSent.length, 0);
});

test('one bot user cannot request unlimited SMS codes', async () => {
  const shop = createShop();
  const chat = createChat(shop);
  for (let index = 0; index < 5; index++) await chat.say(`0912000000${index}`);
  const [blocked] = await chat.say('09120000009');
  assert.equal(shop.calls.otpSent.length, 5);
  assert.match(blocked!.text, /زیاد بود/);
});

test('inactive partners see no prices and cannot add to the cart', async () => {
  const shop = createShop({ users: [user(7, { isActive: false })], products: [product(1, { price: 777_000 })] });
  const chat = createChat(shop, '1', 7);
  const [detail] = await chat.tap(`p:${productRef(1)}`);
  assert.ok(!detail!.text.includes('۷۷۷'));
  const [refused] = await chat.tap(`a:${productRef(1)}:k`);
  assert.match(refused!.text, /تأیید نشده/);
  assert.equal(shop.carts.size, 0);
});

test('order end to end: product, cart, payment choice, review, order and gateway link', async () => {
  const shop = createShop({ users: [user(9)], products: [product(1, { price: 200_000, kermanStock: 10 })] });
  const chat = createChat(shop, '9', 9);
  const [detail] = await chat.tap(`p:${productRef(1)}`);
  assert.match(detail!.text, /۲۰۰٬۰۰۰ تومان/);
  await chat.tap(findButton(detail!, 'مشکی'));
  await chat.tap(`a:${productRef(1)}:k:5`);
  assert.equal(shop.carts.get(9)![0]!.qty, 6);

  const [cart] = await chat.tap('cart');
  assert.match(cart!.text, /۱٬۲۰۰٬۰۰۰ تومان/);
  const [methods] = await chat.tap('co');
  assert.ok(buttonData(methods!.options?.buttons).length >= 4);
  const [review] = await chat.tap(findButton(methods!, 'پرداخت آنلاین'));
  assert.match(review!.text, /بازبینی سفارش/);
  await chat.tap('cn');
  await chat.say('لطفاً سریع ارسال شود');
  const placed = await chat.tap('cok');

  assert.equal(shop.calls.createdOrders.length, 1);
  const input = shop.calls.createdOrders[0]!;
  assert.deepEqual(input.items, [{ productId: 'P-1', warehouse: 'kerman', qty: 6 }]);
  assert.equal(input.paymentMethod, 'aqayepardakht');
  assert.equal(input.paymentPlanId, undefined);
  assert.equal(input.note, 'لطفاً سریع ارسال شود');
  assert.deepEqual(input.attribution, { source: 'telegram', medium: 'bot' });
  assert.equal(shop.carts.has(9), false, 'cart is cleared after ordering');
  assert.match(placed[0]!.text, /ثبت شد/);
  const pay = findButton(placed[1]!, 'پرداخت آنلاین');
  const [link] = await chat.tap(pay);
  assert.equal(link!.options?.buttons?.[0]?.[0]?.url, 'https://pay.example/1');
});

test('a Black Friday cart can only be ordered with the cash plan', async () => {
  const shop = createShop({ users: [user(9)], products: [product(1, { ribbon: BLACK_FRIDAY_RIBBON })] });
  const chat = createChat(shop, '9', 9);
  await chat.tap(`a:${productRef(1)}:k`);
  const [methods] = await chat.tap('co');
  assert.match(methods!.text, /فقط نقدی/);
  const choices = (methods!.options?.buttons ?? []).flat().filter((button) => button.data?.startsWith(`${BOT_CALLBACK_PREFIX}cm:`));
  assert.equal(choices.length, 1);
  assert.match(choices[0]!.text, /نقدی/);
  await chat.tap(choices[0]!.data!);
  await chat.tap('cok');
  assert.equal(shop.calls.createdOrders[0]!.paymentPlanId, 'accessory-cash');
  assert.equal(shop.calls.createdOrders[0]!.paymentMethod, 'accessory-cash');
});

test('checkout asks for missing profile fields, then returns to the payment choice', async () => {
  const shop = createShop({ users: [user(9, { storeName: '' })] });
  const chat = createChat(shop, '9', 9);
  await chat.tap(`a:${productRef(1)}:k`);
  const reply = await chat.tap('co');
  assert.match(reply[1]!.text, /نام فروشگاه/);
  assert.equal(shop.calls.createdOrders.length, 0);
  const resumed = await chat.say('فروشگاه نمونه');
  assert.match(resumed[1]!.text, /روش تسویه/);
});

test('tracking by order code shows only the customer\'s own orders', async () => {
  const shop = createShop({ users: [user(9), user(10, { phone: '09129999999' })] });
  const owner = createChat(shop, '9', 9);
  await owner.tap(`a:${productRef(1)}:k`);
  await owner.tap('co');
  await owner.tap('cm:0');
  await owner.tap('cok');
  const code = shop.orders[0]!.orderCode;

  const [found] = await owner.say(`وضعیت ${code}`);
  assert.match(found!.text, /وضعیت: <b>در انتظار تایید/);
  const stranger = createChat(shop, '10', 10);
  const [hidden] = await stranger.say(code);
  assert.match(hidden!.text, /پیدا نشد/);
  const [list] = await owner.tap('o');
  assert.match(list!.text, new RegExp(code));
});

test('card-to-card receipt photo is stored privately and attached to the order', async () => {
  const shop = createShop({ users: [user(9)] });
  const chat = createChat(shop, '9', 9);
  await chat.tap(`a:${productRef(1)}:k`);
  const [methods] = await chat.tap('co');
  await chat.tap(findButton(methods!, 'نقدی'));
  const placed = await chat.tap('cok');
  await chat.tap(findButton(placed[1]!, 'رسید'));
  const [ok] = await chat.upload({ photo: true });
  assert.deepEqual(shop.calls.uploads, [{ userId: 9, scope: 'payment', mimeType: 'image/jpeg' }]);
  assert.deepEqual(shop.calls.paymentInfo, [{ userId: 9, orderId: 1, paymentMethod: 'accessory-cash', receiptImageUrl: '/api/private-files/1' }]);
  assert.match(ok!.text, /ثبت شد/);
});

test('business licence and identity documents go through the profile services', async () => {
  const shop = createShop({ users: [user(9)] });
  const chat = createChat(shop, '9', 9);
  await chat.tap('cert');
  await chat.upload({ photo: true });
  assert.equal(shop.calls.uploads[0]!.scope, 'credit');
  assert.equal(shop.calls.profiles.at(-1)!.body.certificateFileUrl, '/api/private-files/1');

  await chat.tap('id');
  await chat.say('۰۰۱۲۳۴۵۶۷۸');
  const [verified] = await chat.say('۱۳۷۰/۰۱/۱۵');
  assert.match(verified!.text, /موفقیت/);
  assert.equal(shop.users.get(9)!.isVerifiedIdentity, true);
});

test('credit application: ICS24 report, national id, business type, documents and submit', async () => {
  const shop = createShop({ users: [user(9, { nationalCode: '0012345678' })] });
  const chat = createChat(shop, '9', 9);
  const [step1] = await chat.tap('cra');
  assert.match(step1!.text, /ICS24/);
  const afterReport = await chat.upload({ photo: false, mimeType: 'application/pdf', fileName: 'report.pdf' });
  assert.equal(shop.calls.reports, 1);
  await chat.tap(findButton(afterReport[1]!, '0012345678'));
  const [docPrompt] = await chat.tap('crb:0');
  assert.match(docPrompt!.text, /کارت ملی/);
  await chat.upload({ photo: true });
  await chat.upload({ photo: true });
  const afterCheque = await chat.upload({ photo: true });
  assert.match(afterCheque[1]!.text, /گردش حساب/);
  await chat.tap('skip');
  const [review] = await chat.tap('skip');
  assert.match(review!.text, /بازبینی درخواست اعتبار/);
  const [submitted] = await chat.tap('crok');
  assert.match(submitted!.text, /ثبت شد/);
  assert.deepEqual(shop.calls.credit[0], {
    nationalId: '0012345678',
    businessType: 'مغازه‌دار',
    nationalCardUrl: '/api/private-files/1',
    businessDocsUrl: '/api/private-files/2',
    checkImageUrl: '/api/private-files/3',
    bankStatementUrl: null,
    referralInfo: null,
  });
  assert.ok(shop.calls.uploads.every((upload) => upload.scope === 'credit'));
});

test('files sent outside a document step are not stored', async () => {
  const shop = createShop({ users: [user(9)] });
  const chat = createChat(shop, '9', 9);
  const [reply] = await chat.upload({ photo: true });
  assert.match(reply!.text, /ابتدا/);
  assert.equal(shop.calls.uploads.length, 0);
});

/* ------------------------------------------------------------------ *
 * Platform adapters
 * ------------------------------------------------------------------ */

test('Telegram: only the sender\'s own contact skips the SMS code; photos use the largest size', () => {
  const person = { id: 42 };
  const own = toTelegramBotIncoming(person, 42, { message_id: 1, chat: { id: 42 }, contact: { phone_number: '+989121112233', user_id: 42 } }, undefined);
  assert.equal(own.ownContactPhone, '09121112233');
  const other = toTelegramBotIncoming(person, 42, { message_id: 1, chat: { id: 42 }, contact: { phone_number: '+989121112233', user_id: 43 } }, undefined);
  assert.equal(other.ownContactPhone, undefined);
  assert.equal(other.text, '+989121112233');
  const photo = toTelegramBotIncoming(person, 42, { message_id: 1, chat: { id: 42 }, photo: [{ file_id: 'small' }, { file_id: 'large' }] }, undefined);
  assert.deepEqual(photo.file, { fileId: 'large', photo: true, size: undefined });
});

test('Bale: old keyboard labels map to commands and HTML becomes plain text', () => {
  const incoming = toBaleBotIncoming({ id: 1 }, 1, { chat: { id: 1 }, text: '📦 سفارش‌های من' }, undefined);
  assert.equal(incoming.text, '/orders');
  assert.equal(baleText('<b>سفارش</b> &lt;KP&gt; &amp; ok'), 'سفارش <KP> & ok');
});
