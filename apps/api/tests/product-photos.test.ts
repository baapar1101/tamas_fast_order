import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { photoExists, storedPhotoPath } from '../src/services/product-photos.js';

describe('product photo links', () => {
  it('keeps only photos stored by this site, as site-relative paths', () => {
    assert.equal(storedPhotoPath('/uploads/product/2026-11/a.webp'), '/uploads/product/2026-11/a.webp');
    assert.equal(storedPhotoPath('https://tamasmarket.com/uploads/product/a.webp'), '/uploads/product/a.webp');
    assert.equal(storedPhotoPath('https://example.com/img/a.webp'), null);
    assert.equal(storedPhotoPath('/uploads/../.env'), null);
    assert.equal(storedPhotoPath(''), null);
  });

  it('treats empty and missing stored photos as absent, other links as present', async () => {
    assert.equal(await photoExists(''), false);
    assert.equal(await photoExists('/uploads/product/never-uploaded-0000.webp'), false);
    assert.equal(await photoExists('https://cdn.example.com/a.jpg'), true);
  });
});
