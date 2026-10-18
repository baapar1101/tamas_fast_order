import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPrivateAddress,
  isRemoteImageUrl,
  isStoredImageUrl,
  legacyCacheStemForUrl,
  legacyImageFilename,
  normalizeStoredImageUrl,
} from '../src/lib/product-image-url.js';

describe('product image URL utilities', () => {
  it('recognizes legacy cached filenames and their deterministic hash', () => {
    const url = 'https://image.torob.com/base/images/BB/BA/BBBA4Fz-XEVIwMTU.jpg_/280x280.jpg';
    assert.equal(legacyCacheStemForUrl(url), 'img_d144737fd919');
    assert.equal(legacyImageFilename('/uploads/img_d144737fd919.jpg'), 'img_d144737fd919.jpg');
    assert.equal(legacyImageFilename('/uploads/product/2026-10/photo.webp'), null);
  });

  it('normalizes storage keys without changing absolute or root-relative URLs', () => {
    assert.equal(normalizeStoredImageUrl('product/2026-10/photo.webp', '/uploads'), '/uploads/product/2026-10/photo.webp');
    assert.equal(normalizeStoredImageUrl('/logo.png', '/uploads'), '/logo.png');
    assert.equal(normalizeStoredImageUrl('https://cdn.example.com/a.jpg', '/uploads'), 'https://cdn.example.com/a.jpg');
  });

  it('distinguishes remote, stored and private addresses', () => {
    assert.equal(isRemoteImageUrl('https://cdn.example.com/a.jpg'), true);
    assert.equal(isStoredImageUrl('/uploads/product/2026-10/a.webp', '/uploads'), true);
    assert.equal(isStoredImageUrl('/uploads/img_d144737fd919.jpg', '/uploads'), false);
    assert.equal(isPrivateAddress('127.0.0.1'), true);
    assert.equal(isPrivateAddress('192.168.1.4'), true);
    assert.equal(isPrivateAddress('8.8.8.8'), false);
  });
});

