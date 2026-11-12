import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPrivateAddress,
  isRemoteImageUrl,
  isStoredImageUrl,
  legacyCacheStemForUrl,
  legacyImageFilename,
  localizeOwnImageUrl,
  normalizeStoredImageUrl,
} from '../src/lib/product-image-url.js';

describe('product image URL utilities', () => {
  it('turns full links to our own media library back into stored paths', () => {
    const site = 'https://tamasmarket.com';
    assert.equal(localizeOwnImageUrl('https://tamasmarket.com/uploads/product/2026-11/a.webp', site, '/uploads'), '/uploads/product/2026-11/a.webp');
    assert.equal(localizeOwnImageUrl(' https://www.TamasMarket.com/uploads/product/a.webp ', site, '/uploads'), '/uploads/product/a.webp');
    assert.equal(localizeOwnImageUrl('https://other.com/uploads/a.webp', site, '/uploads'), 'https://other.com/uploads/a.webp');
    assert.equal(localizeOwnImageUrl('https://tamasmarket.com/logo.png', site, '/uploads'), 'https://tamasmarket.com/logo.png');
    assert.equal(localizeOwnImageUrl('/uploads/a.webp', site, '/uploads'), '/uploads/a.webp');
  });

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

