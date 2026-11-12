import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from '@e965/xlsx';
import { matchImportHeaders } from '@tamas/shared';
import { absolutePhotoUrl, buildPhotoLinksWorkbook, groupPhotosByProduct, photoNameParts, PHOTO_LINKS_SHEET } from '../src/admin/components/photoLinks';

test('file names give the product code and photo order', () => {
  assert.deepEqual(photoNameParts('1040012345.jpg'), { code: '1040012345', order: 1 });
  assert.deepEqual(photoNameParts('1040012345-2.JPG'), { code: '1040012345', order: 2 });
  assert.deepEqual(photoNameParts('1040012345_3.png'), { code: '1040012345', order: 3 });
  assert.deepEqual(photoNameParts('1040012345 (4).webp'), { code: '1040012345', order: 4 });
  assert.deepEqual(photoNameParts('۱۰۴۰۰۱۲۳۴۵-۲.jpg'), { code: '1040012345', order: 2 });
  assert.deepEqual(photoNameParts('IMG_20261112.jpg'), { code: 'IMG_20261112', order: 1 });
});

test('photos group into one row per product with main photo and gallery', () => {
  const origin = 'https://tamasmarket.com';
  assert.equal(absolutePhotoUrl('/uploads/product/a.webp', origin), 'https://tamasmarket.com/uploads/product/a.webp');
  const rows = groupPhotosByProduct([
    { fileName: '111-3.jpg', url: '/uploads/c.webp' },
    { fileName: '111.jpg', url: '/uploads/a.webp' },
    { fileName: '222.jpg', url: '/uploads/x.webp' },
    { fileName: '111-2.jpg', url: '/uploads/b.webp' },
  ], origin);
  assert.deepEqual(rows.map((row) => row.code), ['111', '222']);
  assert.equal(rows[0]!.imageUrl, 'https://tamasmarket.com/uploads/a.webp');
  assert.deepEqual(rows[0]!.gallery, ['https://tamasmarket.com/uploads/b.webp', 'https://tamasmarket.com/uploads/c.webp']);
  assert.deepEqual(rows[1]!.gallery, []);
});

test('the links file uses the import template column names', () => {
  const file = buildPhotoLinksWorkbook(XLSX, [
    { fileName: '111.jpg', url: '/uploads/a.webp' },
    { fileName: '111-2.jpg', url: '/uploads/b.webp' },
  ], 'https://tamasmarket.com');
  const book = XLSX.read(file, { type: 'array' });
  assert.deepEqual(book.SheetNames, [PHOTO_LINKS_SHEET, 'همه فایل‌ها']);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[PHOTO_LINKS_SHEET]!, { header: 1 });
  assert.deepEqual(matchImportHeaders(rows[0]!.map(String)).columns.map((c) => c.key), ['productId', 'imageUrl', 'gallery']);
  assert.deepEqual(rows[1], ['111', 'https://tamasmarket.com/uploads/a.webp', 'https://tamasmarket.com/uploads/b.webp', '111.jpg، 111-2.jpg']);
});
