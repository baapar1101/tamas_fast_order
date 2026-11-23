import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { taxonomyKey } from '../src/services/product-create.js';

describe('taxonomyKey', () => {
  it('treats case, spacing, dashes and Arabic letter forms as the same name', () => {
    assert.equal(taxonomyKey('HOCO'), taxonomyKey('hoco'));
    assert.equal(taxonomyKey('OG Super X'), taxonomyKey('og-super_x'));
    assert.equal(taxonomyKey('مک دو دو'), taxonomyKey('مک‌دودو'));
    assert.equal(taxonomyKey('شيائومي'), taxonomyKey('شیائومی'));
    assert.notEqual(taxonomyKey('HOCO'), taxonomyKey('HOKO'));
  });
});
