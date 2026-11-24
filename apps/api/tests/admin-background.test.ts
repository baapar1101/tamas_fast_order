import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ADMIN_BACKGROUND, adminBackgroundSchema, parseAdminBackground } from '@tamas/shared';
import { ownImageKey } from '../src/routes/admin/appearance.js';

const UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

test('a missing or broken stored backdrop falls back to the animated default', () => {
  assert.deepEqual(parseAdminBackground(null), DEFAULT_ADMIN_BACKGROUND);
  assert.deepEqual(parseAdminBackground('not json'), DEFAULT_ADMIN_BACKGROUND);
  assert.deepEqual(parseAdminBackground(JSON.stringify({ mode: 'preset', preset: 'nope' })), DEFAULT_ADMIN_BACKGROUND);
});

test('a saved preset keeps its settings and fills in new fields', () => {
  const value = parseAdminBackground(JSON.stringify({ mode: 'preset', preset: 'ocean', dim: 30 }));
  assert.equal(value.mode, 'preset');
  assert.equal(value.preset, 'ocean');
  assert.equal(value.dim, 30);
  assert.equal(value.blur, 0);
});

test('photo mode needs a photo', () => {
  const result = adminBackgroundSchema.safeParse({ ...DEFAULT_ADMIN_BACKGROUND, mode: 'image', imageUrl: '' });
  assert.equal(result.success, false);
});

test('an admin may only use a backdrop photo they uploaded themselves', () => {
  assert.equal(ownImageKey(7, `/uploads/admin-bg/7-${UUID}.webp`), `admin-bg/7-${UUID}.webp`);
  assert.equal(ownImageKey(7, `/uploads/admin-bg/17-${UUID}.webp`), null);
  assert.equal(ownImageKey(7, `/uploads/product/2026-11/${UUID}.webp`), null);
  assert.equal(ownImageKey(7, `/uploads/admin-bg/7-${UUID}.webp/../../private/x`), null);
  assert.equal(ownImageKey(7, `https://evil.example/uploads/admin-bg/7-${UUID}.webp`), null);
});
