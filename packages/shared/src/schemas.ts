import { z } from 'zod';
import { isValidPhone, normalizePhone } from './phone.js';

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine(isValidPhone, { message: 'شماره موبایل معتبر نیست.' });

export const idSchema = z.coerce.number().int().positive();

/** Sheets hand back "TRUE"/"FALSE"/1/0 as often as real booleans. */
export const sheetBool = z
  .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'بله';
  });

export const priceSchema = z.coerce.number().int().min(0).max(1_000_000_000_000);
export const stockSchema = z.coerce.number().int().min(0).max(1_000_000);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

/* ------------------------------------------------------------------ *
 * Catalogue
 * ------------------------------------------------------------------ */

export const productAttributeSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.string().max(2000),
});

export const productWriteSchema = z.object({
  productId: z.string().trim().min(1).max(80),
  sku: z.string().trim().max(80).optional().nullable(),
  title: z.string().trim().min(1).max(400),
  model: z.string().trim().max(400).optional().nullable(),
  categoryName: z.string().trim().max(160).optional().nullable(),
  brandName: z.string().trim().max(160).optional().nullable(),
  color: z.string().trim().max(160).optional().nullable(),
  colorEn: z.string().trim().max(160).optional().nullable(),
  colorCode: z.string().trim().max(32).optional().nullable(),
  price: priceSchema.default(0),
  oldPrice: priceSchema.optional().nullable(),
  discount: z.coerce.number().int().min(0).max(100).default(0),
  stock: stockSchema.default(0),
  kermanStock: stockSchema.optional().nullable(),
  tehranStock: stockSchema.optional().nullable(),
  warranty: z.string().trim().max(300).optional().nullable(),
  sellType: z.string().trim().max(200).optional().nullable(),
  seller: z.string().trim().max(200).optional().nullable(),
  promotion: sheetBool.default(false),
  status: z.enum(['active', 'inactive']).default('active'),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  gallery: z.array(z.string().max(1000)).max(12).default([]),
  attributes: z.array(productAttributeSchema).max(60).default([]),
  sortOrder: z.coerce.number().int().default(0),
});
export type ProductWrite = z.infer<typeof productWriteSchema>;

export const productPatchSchema = productWriteSchema.partial();

export const categoryWriteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  faName: z.string().trim().min(1).max(160),
  iconUrl: z.string().trim().max(1000).optional().nullable(),
  brandNames: z.array(z.string().trim().max(160)).max(200).default([]),
  sortOrder: z.coerce.number().int().default(0),
});
export type CategoryWrite = z.infer<typeof categoryWriteSchema>;

export const brandWriteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  faName: z.string().trim().min(1).max(160),
  iconUrl: z.string().trim().max(1000).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});
export type BrandWrite = z.infer<typeof brandWriteSchema>;

export const colorWriteSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().max(160).optional().nullable(),
  faName: z.string().trim().max(160).optional().nullable(),
});
export type ColorWrite = z.infer<typeof colorWriteSchema>;

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(160).optional(),
  brands: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v == null ? [] : Array.isArray(v) ? v : v.split(',')))
    .pipe(z.array(z.string().trim().min(1)).max(50)),
  promotion: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().default(true),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'title']).default('price_asc'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(120).default(24),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export const otpRequestSchema = z.object({ phone: phoneSchema });

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().min(4).max(8)),
});

export const PROFILE_FIELDS = [
  'name',
  'lastName',
  'storeName',
  'landline',
  'address',
  'postalCode',
  'certificateFileUrl',
] as const;

export const REQUIRED_PROFILE_FIELDS = ['name', 'lastName', 'storeName', 'address'] as const;

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: 'نام',
  lastName: 'نام خانوادگی',
  storeName: 'نام فروشگاه',
  landline: 'تلفن ثابت',
  address: 'آدرس',
  postalCode: 'کد پستی',
  certificateFileUrl: 'جواز کسب',
};

export const profileWriteSchema = z.object({
  name: z.string().trim().max(120).default(''),
  lastName: z.string().trim().max(120).default(''),
  storeName: z.string().trim().max(200).default(''),
  landline: z.string().trim().max(40).default(''),
  address: z.string().trim().max(1000).default(''),
  postalCode: z.string().trim().max(20).default(''),
  certificateFileUrl: z.string().trim().max(1000).default(''),
});
export type ProfileWrite = z.infer<typeof profileWriteSchema>;

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  'new',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'جدید',
  confirmed: 'تایید شده',
  preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
};

export const WAREHOUSES = ['kerman', 'tehran', 'site'] as const;
export type Warehouse = (typeof WAREHOUSES)[number];

export const WAREHOUSE_LABELS: Record<Warehouse, string> = {
  kerman: 'انبار کرمان',
  tehran: 'انبار تهران',
  site: 'موجودی سایت',
};

export const orderItemInputSchema = z.object({
  productId: z.string().trim().min(1).max(80),
  warehouse: z.enum(WAREHOUSES).default('kerman'),
  qty: z.coerce.number().int().min(1).max(10_000),
});

export const orderCreateSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).max(200),
  address: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
});
export type OrderCreate = z.infer<typeof orderCreateSchema>;

export const orderPatchSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  note: z.string().trim().max(1000).optional(),
});

/* ------------------------------------------------------------------ *
 * Admin: users, settings, sync
 * ------------------------------------------------------------------ */

export const userPatchSchema = z.object({
  name: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  storeName: z.string().trim().max(200).optional(),
  landline: z.string().trim().max(40).optional(),
  address: z.string().trim().max(1000).optional(),
  postalCode: z.string().trim().max(20).optional(),
  certificateFileUrl: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['customer', 'admin']).optional(),
});

export const settingWriteSchema = z.object({
  key: z.string().trim().min(1).max(120),
  value: z.string().max(4000).default(''),
});

export const SYNC_ENTITIES = ['products', 'categories', 'brands', 'colors', 'users', 'orders', 'settings'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const SYNC_ENTITY_LABELS: Record<SyncEntity, string> = {
  products: 'محصولات',
  categories: 'دسته‌بندی‌ها',
  brands: 'برندها',
  colors: 'رنگ‌ها',
  users: 'کاربران',
  orders: 'سفارش‌ها',
  settings: 'تنظیمات',
};

export const syncRunSchema = z.object({
  direction: z.enum(['pull', 'push', 'both']).default('both'),
  entities: z.array(z.enum(SYNC_ENTITIES)).default([...SYNC_ENTITIES]),
  dryRun: z.boolean().default(false),
});
export type SyncRun = z.infer<typeof syncRunSchema>;

/* ------------------------------------------------------------------ *
 * Uploads
 * ------------------------------------------------------------------ */

export const UPLOAD_KINDS = ['product', 'brand', 'category', 'slide', 'certificate', 'other'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const uploadQuerySchema = z.object({
  kind: z.enum(UPLOAD_KINDS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(40),
});
