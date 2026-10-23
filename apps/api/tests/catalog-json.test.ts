import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonArray, productAttributes, productGallery } from '../src/lib/catalog-json.js';

test('legacy imported galleries and attributes retain usable content without crashing', () => {
  assert.deepEqual(productGallery('/uploads/a.webp /uploads/b.webp'), ['/uploads/a.webp', '/uploads/b.webp']);
  assert.deepEqual(productGallery('["/uploads/a.webp", "/uploads/a.webp"]'), ['/uploads/a.webp']);
  assert.deepEqual(productAttributes('  '), []);
  assert.deepEqual(productAttributes([null, { key: 'حافظه', value: '128GB' }, 'bad']), [{ key: 'حافظه', value: '128GB' }]);
  assert.deepEqual(jsonArray('not-json'), []);
});
