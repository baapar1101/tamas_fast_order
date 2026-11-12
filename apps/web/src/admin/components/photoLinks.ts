import { PRODUCT_IMPORT_FIELD_MAP, importHeaderLabel, type ProductImportFieldKey } from '@tamas/shared';

/** The parts of SheetJS this module uses (loaded lazily by the page, directly by tests). */
type XLSXModule = typeof import('@e965/xlsx');
type WorkSheet = import('@e965/xlsx').WorkSheet;

export interface UploadedPhoto {
  /** The name the file had on the photographer's computer. */
  fileName: string;
  /** Stored path or full link, as the upload API returned it. */
  url: string;
}

export interface ProductPhotoRow {
  code: string;
  imageUrl: string;
  gallery: string[];
  files: string[];
}

const DIGIT_SETS = ['۰۱۲۳۴۵۶۷۸۹', '٠١٢٣٤٥٦٧٨٩'];

function latinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String(DIGIT_SETS.map((set) => set.indexOf(digit)).find((i) => i >= 0)));
}

/**
 * Reads the product code and photo order from a file name:
 * `1040012345.jpg` → main photo, `1040012345-2.jpg` / `1040012345_3.jpg` /
 * `1040012345 (4).jpg` → gallery photos in that order.
 */
export function photoNameParts(fileName: string): { code: string; order: number } {
  const stem = latinDigits(fileName.replace(/\.[a-z0-9]{2,5}$/i, '')).trim();
  const match = /^(.*?)\s*(?:[-_ ]\s*(\d{1,2})|\((\d{1,2})\))$/.exec(stem);
  const code = (match?.[1] ?? '').trim();
  // A name that is only a number is the product code itself, never a photo index.
  if (!code) return { code: stem, order: 1 };
  return { code, order: Number(match?.[2] ?? match?.[3] ?? 1) };
}

/** Full link, so the cell can be clicked in Excel to check the photo. */
export function absolutePhotoUrl(url: string, origin: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin.replace(/\/$/, '')}/${url.replace(/^\/+/, '')}`;
}

/** One row per product: the lowest-numbered photo is the main one, the rest are its gallery. */
export function groupPhotosByProduct(photos: UploadedPhoto[], origin: string): ProductPhotoRow[] {
  const groups = new Map<string, { order: number; index: number; url: string; fileName: string }[]>();
  photos.forEach((photo, index) => {
    const { code, order } = photoNameParts(photo.fileName);
    const list = groups.get(code) ?? [];
    list.push({ order, index, url: absolutePhotoUrl(photo.url, origin), fileName: photo.fileName });
    groups.set(code, list);
  });
  return [...groups.entries()].map(([code, list]) => {
    const sorted = [...list].sort((a, b) => a.order - b.order || a.index - b.index);
    return {
      code,
      imageUrl: sorted[0]!.url,
      // The product schema keeps at most 12 gallery photos.
      gallery: sorted.slice(1, 13).map((item) => item.url),
      files: sorted.map((item) => item.fileName),
    };
  });
}

function rtlSheet(rows: unknown[][], widths: number[], XLSX: XLSXModule): WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  (sheet as WorkSheet & { '!views'?: unknown[] })['!views'] = [{ RTL: true }];
  return sheet;
}

const header = (key: ProductImportFieldKey) => importHeaderLabel(PRODUCT_IMPORT_FIELD_MAP.get(key)!);

export const PHOTO_LINKS_SHEET = 'لینک تصاویر';

/**
 * Excel of the uploaded photos. The first sheet uses the import template's
 * own column names, so its link columns can be pasted straight into the
 * products file next to the matching product code.
 */
export function buildPhotoLinksWorkbook(XLSX: XLSXModule, photos: UploadedPhoto[], origin: string): Uint8Array {
  const book = XLSX.utils.book_new();
  const grouped = groupPhotosByProduct(photos, origin);
  XLSX.utils.book_append_sheet(
    book,
    rtlSheet(
      [
        [header('productId'), header('imageUrl'), header('gallery'), 'فایل‌ها'],
        ...grouped.map((row) => [row.code, row.imageUrl, row.gallery.join(' | '), row.files.join('، ')]),
      ],
      [18, 70, 90, 40],
      XLSX,
    ),
    PHOTO_LINKS_SHEET,
  );
  XLSX.utils.book_append_sheet(
    book,
    rtlSheet(
      [['نام فایل', 'لینک'], ...photos.map((photo) => [photo.fileName, absolutePhotoUrl(photo.url, origin)])],
      [40, 80],
      XLSX,
    ),
    'همه فایل‌ها',
  );
  return XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}
