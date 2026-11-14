import type { ZodIssue } from 'zod';
import {
  PRODUCT_IMPORT_FIELD_MAP,
  formatProductTitle,
  normalizeImportValues,
  productWriteSchema,
  type ProductImportFieldKey,
  type ProductImportRowResult,
} from '@tamas/shared';
import { brands, categories } from '../db/schema.js';
import { env } from '../env.js';
import { localizeOwnImageUrl } from '../lib/product-image-url.js';
import { invalidateCatalog } from './catalog.js';
import { logAction } from './audit.js';
import { basketCategoryFor, findTaxonomyId, insertProductRecord, resolveTaxonomy } from './product-create.js';
import { duplicateProductMessage, loadDuplicateCandidates, matchProductDuplicate } from './product-duplicates.js';

const FIELD_NAMES: Record<string, string> = {
  ...Object.fromEntries([...PRODUCT_IMPORT_FIELD_MAP.values()].map((field) => [field.key, field.label])),
};

/** A Persian, column-named reason for the first thing wrong with a row. */
export function describeImportIssue(issue: ZodIssue): string {
  const key = String(issue.path[0] ?? '');
  const column = FIELD_NAMES[key] ? `ستون «${FIELD_NAMES[key]}»` : 'ردیف';
  // Messages written in Persian by the schema itself are already user-facing.
  if (/[؀-ۿ]/.test(issue.message)) return `${column}: ${issue.message}`;
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' ? `${column} خالی است.` : `${column}: مقدار باید ${issue.expected === 'number' ? 'عدد' : 'متن'} باشد.`;
    case 'too_small':
      return issue.type === 'string' ? `${column} خالی است.` : `${column}: مقدار کمتر از حد مجاز است.`;
    case 'too_big':
      return issue.type === 'array' ? `${column}: تعداد موارد بیش از حد مجاز است.` : `${column}: مقدار بیشتر از حد مجاز است.`;
    case 'invalid_enum_value':
      return `${column}: مقدار «${String(issue.received)}» قابل قبول نیست.`;
    default:
      return `${column}: مقدار نامعتبر است.`;
  }
}

function rawText(values: Record<string, unknown>, key: ProductImportFieldKey): string {
  const value = values[key];
  return value == null ? '' : String(value).trim();
}

export interface ImportRowInput {
  rowNumber: number;
  values: Record<string, unknown>;
}

/**
 * Creates new products from spreadsheet rows. Each row stands alone: a bad
 * row is reported and skipped, existing products are never changed, and a
 * product appearing twice in the file is created once. Products are matched by
 * SKU / product code only, never by name (names are edited on the site).
 */
export async function importProductRows(
  rows: ImportRowInput[],
  options: { createMissingTaxonomy: boolean; actorId: number },
): Promise<ProductImportRowResult[]> {
  const candidates = await loadDuplicateCandidates();
  const categoryIds = new Map<string, number | null>();
  const brandIds = new Map<string, number | null>();
  const results: ProductImportRowResult[] = [];

  const taxonomyId = async (kind: 'category' | 'brand', name: string): Promise<number | null> => {
    const cache = kind === 'category' ? categoryIds : brandIds;
    const table = kind === 'category' ? categories : brands;
    if (!cache.has(name)) cache.set(name, await findTaxonomyId(table, name, { liveOnly: true }));
    let id = cache.get(name) ?? null;
    if (id == null && options.createMissingTaxonomy) {
      id = await resolveTaxonomy(table, name);
      cache.set(name, id);
    }
    return id;
  };

  for (const row of rows) {
    const values = Object.fromEntries(
      Object.entries(row.values).filter(([key]) => PRODUCT_IMPORT_FIELD_MAP.has(key as ProductImportFieldKey)),
    ) as Partial<Record<ProductImportFieldKey, unknown>>;
    const base = { rowNumber: row.rowNumber, productId: rawText(values, 'productId'), title: rawText(values, 'title') };

    try {
      const parsed = productWriteSchema.safeParse(normalizeImportValues(values));
      if (!parsed.success) {
        results.push({ ...base, status: 'error', message: describeImportIssue(parsed.error.issues[0]!) });
        continue;
      }
      const body = parsed.data;
      body.title = formatProductTitle(body.title);
      const ownImage = (url: string) => localizeOwnImageUrl(url, env.PUBLIC_SITE_URL, env.STORAGE_PUBLIC_URL);
      if (body.imageUrl) body.imageUrl = ownImage(body.imageUrl);
      body.gallery = body.gallery.map(ownImage);
      const result = { ...base, productId: body.productId, title: body.title };

      const duplicate = matchProductDuplicate(candidates, body, undefined, { codesOnly: true });
      if (duplicate) {
        results.push({ ...result, status: 'duplicate', message: duplicateProductMessage(duplicate) });
        continue;
      }

      let categoryId: number | null = null;
      if (body.categoryName?.trim()) {
        categoryId = await taxonomyId('category', body.categoryName.trim());
        if (categoryId == null) {
          results.push({ ...result, status: 'error', message: `دسته‌بندی «${body.categoryName}» در سایت وجود ندارد؛ نام دقیق را از برگهٔ «دسته‌بندی‌ها» فایل نمونه بردارید.` });
          continue;
        }
      } else {
        categoryId = await basketCategoryFor(body.type);
      }

      let brandId: number | null = null;
      if (body.brandName?.trim()) {
        brandId = await taxonomyId('brand', body.brandName.trim());
        if (brandId == null) {
          results.push({ ...result, status: 'error', message: `برند «${body.brandName}» در سایت وجود ندارد؛ نام دقیق را از برگهٔ «برندها» فایل نمونه بردارید.` });
          continue;
        }
      }

      const created = await insertProductRecord(body, { categoryId, brandId });
      candidates.push({
        id: created.id,
        productId: created.productId,
        sku: created.sku,
        title: created.title,
        model: created.model,
        color: created.color,
        colorEn: created.colorEn,
        type: created.type,
        digikalaLink: created.digikalaLink,
      });
      results.push({ ...result, id: created.id, status: 'created', message: 'کالا ساخته شد.' });
    } catch (error) {
      results.push({ ...base, status: 'error', message: error instanceof Error ? error.message : 'ثبت این ردیف ناموفق بود.' });
    }
  }

  const created = results.filter((result) => result.status === 'created');
  if (created.length) invalidateCatalog();
  await logAction(options.actorId, 'import', 'product', null, {
    rows: rows.length,
    created: created.length,
    duplicate: results.filter((result) => result.status === 'duplicate').length,
    error: results.filter((result) => result.status === 'error').length,
    productIds: created.map((result) => result.productId).slice(0, 200),
  });
  return results;
}
