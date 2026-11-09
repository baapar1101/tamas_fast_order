import type { ProductDTO } from '@tamas/shared';

export type CatalogGroupBy = 'category' | 'brand';

type GroupableProduct = Pick<ProductDTO, 'id' | 'title' | 'categoryName' | 'categoryFaName' | 'brandName' | 'brandFaName'>;

const OTHER_CATEGORY = 'سایر دسته‌ها';
const OTHER_BRAND = 'سایر برندها';

export function catalogCategoryLabel(product: GroupableProduct): string {
  return product.categoryFaName?.trim() || product.categoryName?.trim() || OTHER_CATEGORY;
}

export function catalogBrandLabel(product: GroupableProduct): string {
  return product.brandFaName?.trim() || product.brandName?.trim() || OTHER_BRAND;
}

export function catalogGroupLabel(product: GroupableProduct, groupBy: CatalogGroupBy): string {
  return groupBy === 'category' ? catalogCategoryLabel(product) : catalogBrandLabel(product);
}

/** The label printed under each title: the dimension the catalog is not grouped by. */
export function catalogSecondaryLabel(product: GroupableProduct, groupBy: CatalogGroupBy): string {
  return groupBy === 'category' ? catalogBrandLabel(product) : catalogCategoryLabel(product);
}

const collator = new Intl.Collator('fa', { numeric: true, sensitivity: 'base' });

function compareLabels(a: string, b: string, other: string): number {
  if (a === b) return 0;
  // "Other" always closes the catalog.
  if (a === other) return 1;
  if (b === other) return -1;
  return collator.compare(a, b);
}

export interface CatalogGroup<T> {
  label: string;
  items: T[];
}

/** Groups by category or brand, then orders inside each group by the other one and the title. */
export function groupCatalogProducts<T extends GroupableProduct>(products: T[], groupBy: CatalogGroupBy): CatalogGroup<T>[] {
  const primaryOther = groupBy === 'category' ? OTHER_CATEGORY : OTHER_BRAND;
  const secondaryOther = groupBy === 'category' ? OTHER_BRAND : OTHER_CATEGORY;
  const sorted = [...products].sort((a, b) =>
    compareLabels(catalogGroupLabel(a, groupBy), catalogGroupLabel(b, groupBy), primaryOther)
    || compareLabels(catalogSecondaryLabel(a, groupBy), catalogSecondaryLabel(b, groupBy), secondaryOther)
    || collator.compare(a.title, b.title)
    || a.id - b.id);

  const groups: CatalogGroup<T>[] = [];
  for (const product of sorted) {
    const label = catalogGroupLabel(product, groupBy);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(product);
    else groups.push({ label, items: [product] });
  }
  return groups;
}

export type CatalogRow<T> =
  | { kind: 'heading'; label: string; count: number; continued: boolean }
  | { kind: 'items'; items: T[] };

export interface CatalogLayout {
  columns: number;
  /** Usable height of the product area on one sheet, in mm. */
  pageHeight: number;
  rowHeight: number;
  headingHeight: number;
  gap: number;
}

export const A4_CATALOG_LAYOUT: CatalogLayout = { columns: 4, pageHeight: 240, rowHeight: 43, headingHeight: 6, gap: 2 };

/**
 * Splits the groups into A4 sheets: every group opens with a heading row, a group
 * never shares a product row with another one, and a group that runs onto the
 * next sheet repeats its heading there.
 */
export function paginateCatalog<T>(groups: CatalogGroup<T>[], layout: CatalogLayout = A4_CATALOG_LAYOUT): CatalogRow<T>[][] {
  const pages: CatalogRow<T>[][] = [];
  let page: CatalogRow<T>[] = [];
  let used = 0;

  const fits = (height: number) => used + (page.length > 0 ? layout.gap : 0) + height <= layout.pageHeight;
  const push = (row: CatalogRow<T>, height: number) => {
    used += (page.length > 0 ? layout.gap : 0) + height;
    page.push(row);
  };
  const newPage = () => {
    if (page.length > 0) pages.push(page);
    page = [];
    used = 0;
  };

  for (const group of groups) {
    for (let start = 0; start < group.items.length; start += layout.columns) {
      const items = group.items.slice(start, start + layout.columns);
      const opensGroup = start === 0;
      let withHeading = opensGroup || page.length === 0;
      if (!fits(layout.rowHeight + (withHeading ? layout.headingHeight + layout.gap : 0))) {
        newPage();
        withHeading = true;
      }
      if (withHeading) {
        push({ kind: 'heading', label: group.label, count: group.items.length, continued: !opensGroup }, layout.headingHeight);
      }
      push({ kind: 'items', items }, layout.rowHeight);
    }
  }
  newPage();
  return pages;
}
