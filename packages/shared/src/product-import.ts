import { z } from 'zod';

/**
 * Excel import of new products: the columns an admin can pick for the
 * template, how a header cell is recognised, and how a raw cell becomes a
 * value the product schema accepts. Shared so the browser (template, preview,
 * result export) and the API (validation, creation) agree on every column.
 */

export type ProductImportFieldKey =
  | 'productId' | 'title' | 'price' | 'costPrice' | 'oldPrice' | 'discount'
  | 'stock' | 'kermanStock' | 'tehranStock'
  | 'categoryName' | 'brandName' | 'model' | 'sku' | 'parentProductId'
  | 'color' | 'colorEn' | 'colorCode'
  | 'warranty' | 'seller' | 'sellType' | 'promotion' | 'status'
  | 'subTitle' | 'description' | 'keywords' | 'ribbon'
  | 'weight' | 'dimensions' | 'imageUrl' | 'gallery' | 'digikalaLink' | 'sortOrder';

export type ProductImportFieldKind = 'code' | 'text' | 'longtext' | 'integer' | 'price' | 'percent' | 'boolean' | 'status' | 'url' | 'urls';

export interface ProductImportField {
  key: ProductImportFieldKey;
  /** Column header in the template (Persian). */
  label: string;
  group: ProductImportGroup;
  kind: ProductImportFieldKind;
  required?: boolean;
  /** Ticked in the template builder until the admin changes it. */
  defaultSelected?: boolean;
  hint: string;
  example: string;
  /** Other header spellings recognised on import. */
  aliases?: string[];
}

export type ProductImportGroup = 'main' | 'pricing' | 'taxonomy' | 'variant' | 'sales' | 'content';

export const PRODUCT_IMPORT_GROUPS: { id: ProductImportGroup; label: string }[] = [
  { id: 'main', label: 'اطلاعات اصلی' },
  { id: 'pricing', label: 'قیمت و موجودی' },
  { id: 'taxonomy', label: 'دسته‌بندی و برند' },
  { id: 'variant', label: 'مدل و رنگ' },
  { id: 'sales', label: 'فروش و نمایش' },
  { id: 'content', label: 'محتوا و تصویر' },
];

export const PRODUCT_IMPORT_FIELDS: ProductImportField[] = [
  { key: 'productId', label: 'کد محصول', group: 'main', kind: 'code', required: true, defaultSelected: true, hint: 'فقط عدد، ۸ تا ۱۲ رقم و غیرتکراری. ستون را در اکسل «متنی» کنید تا صفرهای ابتدای کد حذف نشوند.', example: '1040012345', aliases: ['کد کالا', 'کد', 'product id', 'productid'] },
  { key: 'title', label: 'عنوان کالا', group: 'main', kind: 'text', required: true, defaultSelected: true, hint: 'نام کامل کالا که در سایت نمایش داده می‌شود.', example: 'قاب سیلیکونی سامسونگ A57', aliases: ['عنوان', 'نام کالا', 'نام محصول', 'title'] },
  { key: 'sku', label: 'SKU', group: 'main', kind: 'text', hint: 'شناسهٔ انبار؛ اختیاری و غیرتکراری.', example: 'CASE-A57-BLK', aliases: ['کد انبار'] },
  { key: 'parentProductId', label: 'کد محصول مادر', group: 'main', kind: 'code', hint: 'برای رنگ‌ها و تنوع‌های یک کالا، کد محصول اصلی را وارد کنید.', example: '1040012300', aliases: ['کد مادر'] },
  { key: 'price', label: 'قیمت فروش (تومان)', group: 'pricing', kind: 'price', defaultSelected: true, hint: 'به تومان، بدون ممیز؛ جداکنندهٔ هزارگان مجاز است.', example: '1250000', aliases: ['قیمت', 'قیمت فروش', 'price'] },
  { key: 'oldPrice', label: 'قیمت قبل از تخفیف (تومان)', group: 'pricing', kind: 'price', hint: 'اگر خالی باشد، قیمت خط‌خورده نمایش داده نمی‌شود.', example: '1400000', aliases: ['قیمت قبل', 'قیمت قدیم'] },
  { key: 'discount', label: 'درصد تخفیف', group: 'pricing', kind: 'percent', hint: 'عدد ۰ تا ۱۰۰.', example: '10', aliases: ['تخفیف'] },
  { key: 'costPrice', label: 'قیمت خرید (تومان)', group: 'pricing', kind: 'price', hint: 'فقط در پنل مدیریت دیده می‌شود.', example: '980000', aliases: ['قیمت خرید'] },
  { key: 'stock', label: 'موجودی سایت', group: 'pricing', kind: 'integer', defaultSelected: true, hint: 'تعداد قابل فروش در سایت.', example: '25', aliases: ['موجودی', 'تعداد', 'stock'] },
  { key: 'kermanStock', label: 'موجودی انبار کرمان', group: 'pricing', kind: 'integer', hint: 'اختیاری؛ خالی یعنی صفر.', example: '10', aliases: ['انبار کرمان'] },
  { key: 'tehranStock', label: 'موجودی انبار تهران', group: 'pricing', kind: 'integer', hint: 'اختیاری؛ خالی یعنی صفر.', example: '15', aliases: ['انبار تهران'] },
  { key: 'categoryName', label: 'دسته‌بندی', group: 'taxonomy', kind: 'text', defaultSelected: true, hint: 'نام دقیق یکی از دسته‌بندی‌های برگهٔ «دسته‌بندی‌ها».', example: 'لوازم جانبی موبایل', aliases: ['دسته', 'دسته بندی', 'category'] },
  { key: 'brandName', label: 'برند', group: 'taxonomy', kind: 'text', defaultSelected: true, hint: 'نام دقیق یکی از برندهای برگهٔ «برندها».', example: 'سامسونگ', aliases: ['brand'] },
  { key: 'model', label: 'مدل', group: 'variant', kind: 'text', defaultSelected: true, hint: 'مدل دستگاه یا کالا.', example: 'Galaxy A57', aliases: ['model'] },
  { key: 'color', label: 'رنگ', group: 'variant', kind: 'text', defaultSelected: true, hint: 'نام فارسی رنگ.', example: 'مشکی', aliases: ['color'] },
  { key: 'colorEn', label: 'رنگ (انگلیسی)', group: 'variant', kind: 'text', hint: 'نام انگلیسی رنگ.', example: 'Black', aliases: ['رنگ انگلیسی'] },
  { key: 'colorCode', label: 'کد رنگ', group: 'variant', kind: 'text', hint: 'کد هگز مثل #000000.', example: '#000000' },
  { key: 'warranty', label: 'گارانتی', group: 'sales', kind: 'text', hint: 'متن گارانتی.', example: 'گارانتی ۱۸ ماهه' },
  { key: 'seller', label: 'فروشنده', group: 'sales', kind: 'text', hint: 'نام فروشنده.', example: 'تماس مارکت' },
  { key: 'sellType', label: 'نوع فروش', group: 'sales', kind: 'text', hint: 'مثلاً عمده یا تکی.', example: 'عمده' },
  { key: 'promotion', label: 'کالای جشنواره', group: 'sales', kind: 'boolean', hint: '«بله» یا «خیر».', example: 'بله', aliases: ['جشنواره', 'پیشنهاد ویژه'] },
  { key: 'status', label: 'وضعیت', group: 'sales', kind: 'status', hint: '«فعال» یا «غیرفعال»؛ خالی یعنی فعال.', example: 'فعال' },
  { key: 'ribbon', label: 'برچسب روی کالا', group: 'sales', kind: 'text', hint: 'متن کوتاه مثل «جدید».', example: 'جدید', aliases: ['برچسب'] },
  { key: 'sortOrder', label: 'ترتیب نمایش', group: 'sales', kind: 'integer', hint: 'عدد کوچک‌تر بالاتر نمایش داده می‌شود.', example: '0' },
  { key: 'subTitle', label: 'زیرعنوان', group: 'content', kind: 'text', hint: 'یک خط توضیح کوتاه.', example: 'ضد ضربه با لبهٔ برجسته' },
  { key: 'description', label: 'توضیحات', group: 'content', kind: 'longtext', hint: 'متن کامل معرفی کالا.', example: 'قاب سیلیکونی با پوشش داخلی نرم…' },
  { key: 'keywords', label: 'کلمات کلیدی', group: 'content', kind: 'text', hint: 'با ویرگول جدا کنید.', example: 'قاب، کاور، A57' },
  { key: 'imageUrl', label: 'لینک تصویر اصلی', group: 'content', kind: 'url', hint: 'آدرس کامل تصویر (https://…)؛ برای عکس‌هایی که خودتان گرفته‌اید، از پنل ← «فایل‌ها و رسانه» آپلود کنید و لینک بگیرید.', example: 'https://tamasmarket.com/uploads/case-a57.webp', aliases: ['تصویر', 'عکس'] },
  { key: 'gallery', label: 'لینک تصاویر گالری', group: 'content', kind: 'urls', hint: 'چند آدرس را با | از هم جدا کنید (حداکثر ۱۲)؛ اکسل لینک‌های «فایل‌ها و رسانه» این ستون را آماده می‌دهد.', example: 'https://…/1.webp | https://…/2.webp', aliases: ['گالری'] },
  { key: 'digikalaLink', label: 'لینک دیجی‌کالا', group: 'content', kind: 'url', hint: 'برای دریافت خودکار تصاویر و مشخصات.', example: 'https://www.digikala.com/product/dkp-123456/', aliases: ['دیجی کالا', 'لینک دیجیکالا'] },
  { key: 'weight', label: 'وزن (گرم)', group: 'content', kind: 'integer', hint: 'عدد به گرم.', example: '120' },
  { key: 'dimensions', label: 'ابعاد', group: 'content', kind: 'text', hint: 'مثلاً 10×5×2 سانتی‌متر.', example: '16×8×1' },
];

export const PRODUCT_IMPORT_FIELD_MAP = new Map(PRODUCT_IMPORT_FIELDS.map((field) => [field.key, field]));
export const REQUIRED_IMPORT_KEYS = PRODUCT_IMPORT_FIELDS.filter((field) => field.required).map((field) => field.key);
export const DEFAULT_IMPORT_KEYS = PRODUCT_IMPORT_FIELDS.filter((field) => field.required || field.defaultSelected).map((field) => field.key);

/** Header in the template; required columns are starred. */
export function importHeaderLabel(field: ProductImportField): string {
  return field.required ? `${field.label} *` : field.label;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit);
    return String(persian >= 0 ? persian : ARABIC_DIGITS.indexOf(digit));
  });
}

/** Compares headers loosely: no stars, units in brackets, spaces, ZWNJ, Arabic ی/ک or case. */
export function normalizeHeader(value: unknown): string {
  return toLatinDigits(String(value ?? ''))
    .replace(/\*/g, '')
    .replace(/[(（][^)）]*[)）]/g, '')
    .replace(/[‌‏‎\s_\-]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase();
}

const HEADER_LOOKUP = (() => {
  const map = new Map<string, ProductImportFieldKey>();
  for (const field of PRODUCT_IMPORT_FIELDS) {
    for (const name of [field.label, field.key, ...(field.aliases ?? [])]) {
      const normalized = normalizeHeader(name);
      if (normalized && !map.has(normalized)) map.set(normalized, field.key);
    }
  }
  return map;
})();

export function matchImportHeader(header: unknown): ProductImportFieldKey | null {
  return HEADER_LOOKUP.get(normalizeHeader(header)) ?? null;
}

export interface ImportHeaderMatch {
  /** Column index → field, for recognised columns only. */
  columns: Array<{ index: number; header: string; key: ProductImportFieldKey }>;
  ignored: string[];
  duplicates: string[];
  missingRequired: ProductImportFieldKey[];
}

export function matchImportHeaders(headers: unknown[]): ImportHeaderMatch {
  const columns: ImportHeaderMatch['columns'] = [];
  const ignored: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<ProductImportFieldKey>();
  headers.forEach((raw, index) => {
    const header = String(raw ?? '').trim();
    if (!header) return;
    const key = matchImportHeader(header);
    if (!key) {
      ignored.push(header);
      return;
    }
    if (seen.has(key)) {
      duplicates.push(header);
      return;
    }
    seen.add(key);
    columns.push({ index, header, key });
  });
  return { columns, ignored, duplicates, missingRequired: REQUIRED_IMPORT_KEYS.filter((key) => !seen.has(key)) };
}

function cleanText(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/ /g, ' ').trim();
}

function cleanNumber(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return toLatinDigits(cleanText(value)).replace(/[,٬،\s]/g, '').replace(/٫/g, '.');
}

const YES = new Set(['بله', 'آره', 'اره', 'هست', 'دارد', 'فعال', 'yes', 'y', 'true', '1', 'x', '✓', '✔']);
const NO = new Set(['خیر', 'نه', 'نیست', 'ندارد', 'غیرفعال', 'no', 'n', 'false', '0']);

/**
 * Turns one spreadsheet row into the shape `productWriteSchema` validates.
 * Empty cells are left out so the schema defaults apply; values it cannot
 * read are kept as-is so validation reports them against the right column.
 */
export function normalizeImportValues(values: Partial<Record<ProductImportFieldKey, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values) as Array<[ProductImportFieldKey, unknown]>) {
    const field = PRODUCT_IMPORT_FIELD_MAP.get(key);
    if (!field) continue;
    if (raw == null || cleanText(raw) === '') continue;
    switch (field.kind) {
      case 'code': {
        const code = typeof raw === 'number' ? String(Math.round(raw)) : toLatinDigits(cleanText(raw)).replace(/\s/g, '');
        out[key] = code;
        break;
      }
      case 'integer':
      case 'price':
      case 'percent': {
        const number = cleanNumber(raw);
        out[key] = /^-?\d+(\.\d+)?$/.test(number) ? Math.round(Number(number)) : cleanText(raw);
        break;
      }
      case 'boolean': {
        const text = normalizeHeader(raw);
        out[key] = YES.has(text) ? true : NO.has(text) ? false : cleanText(raw);
        break;
      }
      case 'status': {
        const text = normalizeHeader(raw);
        out[key] = ['فعال', 'active', '1', 'بله'].includes(text) ? 'active'
          : ['غیرفعال', 'inactive', '0', 'خیر'].includes(text) ? 'inactive' : cleanText(raw);
        break;
      }
      case 'urls':
        out[key] = cleanText(raw).split(/[|\n]+/).map((url) => url.trim()).filter(Boolean);
        break;
      default:
        out[key] = cleanText(raw);
    }
  }
  return out;
}

export const productImportRowSchema = z.object({
  rowNumber: z.number().int().min(1).max(1_000_000),
  values: z.record(z.string(), z.unknown()),
});

export const productImportRequestSchema = z.object({
  rows: z.array(productImportRowSchema).min(1).max(200),
  /** Create categories and brands that don't exist yet instead of rejecting the row. */
  createMissingTaxonomy: z.boolean().default(false),
});

export type ProductImportStatus = 'created' | 'duplicate' | 'error';

export interface ProductImportRowResult {
  rowNumber: number;
  status: ProductImportStatus;
  productId: string;
  title: string;
  /** Database id of the created product. */
  id?: number;
  message: string;
}

export const PRODUCT_IMPORT_STATUS_LABELS: Record<ProductImportStatus, string> = {
  created: 'ایجاد شد',
  duplicate: 'تکراری، رد شد',
  error: 'خطا',
};

export const MAX_PRODUCT_IMPORT_ROWS = 5000;
