import type { ProductDTO } from '@tamas/shared';
import { toAsciiDigits } from '@tamas/shared';

export type SheetColumnKey =
  | 'title' | 'sku' | 'model' | 'categoryName' | 'brandName' | 'color'
  | 'price' | 'oldPrice' | 'discount' | 'stock' | 'kermanStock' | 'tehranStock'
  | 'totalStock' | 'status' | 'promotion' | 'warranty' | 'seller'
  | 'sortOrder' | 'createdAt' | 'updatedAt' | 'imageUrl';

export type SheetEditableKey = Exclude<SheetColumnKey, 'sku' | 'totalStock' | 'createdAt' | 'updatedAt' | 'imageUrl'>;
export type SheetDraft = Partial<Record<SheetEditableKey, string | boolean>>;
export type SheetDrafts = Record<number, SheetDraft>;

export interface SheetColumn {
  key: SheetColumnKey;
  label: string;
  group: 'کالا' | 'قیمت و موجودی' | 'نمایش';
  kind: 'text' | 'number' | 'select' | 'toggle' | 'read';
  width: number;
  hint?: string;
}

export const SHEET_COLUMNS: SheetColumn[] = [
  { key: 'title', label: 'عنوان محصول', group: 'کالا', kind: 'text', width: 300 },
  { key: 'sku', label: 'SKU', group: 'کالا', kind: 'read', width: 155, hint: 'برای تغییر شناسه از فرم کامل محصول استفاده کنید.' },
  { key: 'model', label: 'مدل', group: 'کالا', kind: 'text', width: 210 },
  { key: 'categoryName', label: 'دسته‌بندی', group: 'کالا', kind: 'select', width: 170 },
  { key: 'brandName', label: 'برند', group: 'کالا', kind: 'select', width: 160 },
  { key: 'color', label: 'رنگ', group: 'کالا', kind: 'text', width: 140 },
  { key: 'price', label: 'قیمت (تومان)', group: 'قیمت و موجودی', kind: 'number', width: 155 },
  { key: 'oldPrice', label: 'قیمت قبلی', group: 'قیمت و موجودی', kind: 'number', width: 155 },
  { key: 'discount', label: 'تخفیف ٪', group: 'قیمت و موجودی', kind: 'number', width: 110 },
  { key: 'stock', label: 'موجودی کلی', group: 'قیمت و موجودی', kind: 'number', width: 120, hint: 'اگر موجودی انبارها ثبت شده باشد، فروشگاه جمع آن‌ها را ملاک قرار می‌دهد.' },
  { key: 'kermanStock', label: 'انبار کرمان', group: 'قیمت و موجودی', kind: 'number', width: 120 },
  { key: 'tehranStock', label: 'انبار تهران', group: 'قیمت و موجودی', kind: 'number', width: 120 },
  { key: 'totalStock', label: 'موجودی نمایشی', group: 'قیمت و موجودی', kind: 'read', width: 135 },
  { key: 'status', label: 'وضعیت', group: 'نمایش', kind: 'select', width: 135 },
  { key: 'promotion', label: 'پیشنهاد ویژه', group: 'نمایش', kind: 'toggle', width: 125 },
  { key: 'warranty', label: 'گارانتی', group: 'نمایش', kind: 'text', width: 180 },
  { key: 'seller', label: 'فروشنده', group: 'نمایش', kind: 'text', width: 175 },
  { key: 'sortOrder', label: 'ترتیب نمایش', group: 'نمایش', kind: 'number', width: 125 },
  { key: 'createdAt', label: 'تاریخ ایجاد', group: 'نمایش', kind: 'read', width: 145 },
  { key: 'updatedAt', label: 'آخرین ویرایش', group: 'نمایش', kind: 'read', width: 145 },
  { key: 'imageUrl', label: 'تصویر', group: 'نمایش', kind: 'read', width: 94 },
];

export const DEFAULT_SHEET_COLUMNS: SheetColumnKey[] = [
  'title', 'sku', 'color', 'price', 'stock', 'kermanStock', 'tehranStock', 'status', 'updatedAt',
];

const OPTIONAL_TEXT_LIMITS: Partial<Record<SheetEditableKey, number>> = {
  model: 400, color: 160, warranty: 300, seller: 200,
};

export function sheetCellValue(product: ProductDTO, key: SheetColumnKey): string | boolean {
  if (key === 'totalStock') {
    const split = product.kermanStock + product.tehranStock;
    return String(split > 0 ? split : product.stock);
  }
  if (key === 'createdAt' || key === 'updatedAt') {
    const date = product[key];
    return date ? new Date(date).toLocaleDateString('fa-IR') : '—';
  }
  if (key === 'promotion') return product.promotion;
  if (key === 'imageUrl') return product.imageUrl ?? '';
  return String(product[key] ?? '');
}

function parseWholeNumber(raw: string, key: SheetEditableKey, label: string): number | null {
  const clean = toAsciiDigits(raw).replace(/[\s,٬،]/g, '');
  if (key === 'oldPrice' && clean === '') return null;
  const signed = key === 'sortOrder';
  if (!(signed ? /^-?\d+$/ : /^\d+$/).test(clean)) throw new Error(`${label}: عدد صحیح معتبر وارد کنید.`);
  const value = Number(clean);
  const max = key === 'discount' ? 100 : key === 'stock' || key === 'kermanStock' || key === 'tehranStock' ? 1_000_000 : 1_000_000_000_000;
  if (!Number.isSafeInteger(value) || (!signed && value < 0) || value > max) throw new Error(`${label}: مقدار خارج از محدوده است.`);
  return value;
}

/** Validate the full draft before the first network write, then PATCH only changed fields. */
export function parseSheetPatch(draft: SheetDraft): Record<string, string | number | boolean | null> {
  const patch: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, rawValue] of Object.entries(draft)) {
    const column = SHEET_COLUMNS.find((item) => item.key === rawKey);
    if (!column || column.kind === 'read') continue;
    const key = column.key as SheetEditableKey;
    if (key === 'promotion') {
      patch[key] = Boolean(rawValue);
    } else if (key === 'status') {
      if (rawValue !== 'active' && rawValue !== 'inactive') throw new Error('وضعیت معتبر نیست.');
      patch[key] = rawValue;
    } else if (column.kind === 'number') {
      patch[key] = parseWholeNumber(String(rawValue), key, column.label);
    } else {
      const value = String(rawValue).trim();
      const max = key === 'title' ? 400 : key === 'categoryName' || key === 'brandName' ? 160 : OPTIONAL_TEXT_LIMITS[key] ?? 400;
      if (key === 'title' && !value) throw new Error('عنوان محصول نمی‌تواند خالی باشد.');
      if (value.length > max) throw new Error(`${column.label}: حداکثر ${max} کاراکتر مجاز است.`);
      patch[key] = key === 'title' ? value : value || null;
    }
  }
  return patch;
}
