import assert from 'node:assert/strict';
import test from 'node:test';
import { groupCatalogProducts, paginateCatalog, A4_CATALOG_LAYOUT } from '../src/admin/components/catalogPages';

let nextId = 1;
const product = (title: string, category: string | null, brand: string | null) => ({
  id: nextId++,
  title,
  categoryName: null,
  categoryFaName: category,
  brandName: null,
  brandFaName: brand,
});

const sample = [
  product('کابل تایپ‌سی', 'کابل', 'یسیدو'),
  product('شارژر ۲۰ وات', 'شارژر', 'اکسیژن'),
  product('کابل لایتنینگ', 'کابل', 'اکسیژن'),
  product('بی‌نام', null, null),
  product('شارژر ۶۵ وات', 'شارژر', 'یسیدو'),
];

test('catalog groups by category, ordered by brand then title inside, unknowns last', () => {
  const groups = groupCatalogProducts(sample, 'category');
  assert.deepEqual(groups.map((g) => g.label), ['شارژر', 'کابل', 'سایر دسته‌ها']);
  assert.deepEqual(groups[1].items.map((p) => p.title), ['کابل لایتنینگ', 'کابل تایپ‌سی']);
});

test('catalog groups by brand when asked', () => {
  const groups = groupCatalogProducts(sample, 'brand');
  assert.deepEqual(groups.map((g) => g.label), ['اکسیژن', 'یسیدو', 'سایر برندها']);
  assert.deepEqual(groups[0].items.map((p) => p.title), ['شارژر ۲۰ وات', 'کابل لایتنینگ']);
});

test('every page fits, every group opens with a heading and a split group repeats it', () => {
  const many = Array.from({ length: 30 }, (_, i) => product(`کالا ${i}`, i < 25 ? 'قاب' : 'گلس', 'برند'));
  const pages = paginateCatalog(groupCatalogProducts(many, 'category'));
  const { pageHeight, rowHeight, headingHeight, gap } = A4_CATALOG_LAYOUT;
  for (const page of pages) {
    const height = page.reduce((sum, row) => sum + (row.kind === 'heading' ? headingHeight : rowHeight), 0) + gap * (page.length - 1);
    assert.ok(height <= pageHeight, `page height ${height}mm`);
    assert.equal(page[0].kind, 'heading');
  }
  const headings = pages.flat().filter((row) => row.kind === 'heading');
  assert.deepEqual(headings.map((h) => [h.label, h.continued]), [['قاب', false], ['قاب', true], ['گلس', false]]);
  const printed = pages.flat().flatMap((row) => (row.kind === 'items' ? row.items : []));
  assert.equal(printed.length, 30);
  assert.ok(pages.flat().every((row) => row.kind === 'heading' || row.items.length <= 4));
});
