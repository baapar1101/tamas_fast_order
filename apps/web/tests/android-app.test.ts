import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ANDROID_APP, ANDROID_SUGGESTION_DELAY, isAndroidBrowser, isAndroidSuggestionDismissed } from '../src/storefront/androidApp.js';

test('Android release URL and nginx exact download route stay aligned', () => {
  const nginx = readFileSync(new URL('../../../deploy/nginx/android-download.conf', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../../../mobile/package.json', import.meta.url), 'utf8'));
  assert.equal(ANDROID_APP.version, pkg.version);
  assert.ok(nginx.includes(`location = ${ANDROID_APP.url}`));
  assert.ok(nginx.includes(`/mobile/releases/${ANDROID_APP.filename};`));
  assert.match(nginx, /application\/vnd\.android\.package-archive/);
  assert.match(nginx, /Content-Disposition 'attachment;/);
  assert.match(ANDROID_APP.sha256, /^[a-f0-9]{64}$/);
  assert.ok(ANDROID_APP.bytes > 1_000_000);
});

test('dismissal expires after a week and invalid browser storage cannot hide the suggestion forever', () => {
  const now = 1_000_000;
  assert.equal(isAndroidSuggestionDismissed(null, now), false);
  assert.equal(isAndroidSuggestionDismissed('not-a-number', now), false);
  assert.equal(isAndroidSuggestionDismissed(String(now - 1), now), false);
  assert.equal(isAndroidSuggestionDismissed(String(now + ANDROID_SUGGESTION_DELAY), now), true);
  assert.equal(isAndroidSuggestionDismissed(String(now + ANDROID_SUGGESTION_DELAY + 1), now), false);
});

test('only Android browser users skip the duplicate web-app install suggestion', () => {
  assert.equal(isAndroidBrowser('Mozilla/5.0 (Linux; Android 14) Chrome/140'), true);
  assert.equal(isAndroidBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18)'), false);
  assert.equal(isAndroidBrowser('Mozilla/5.0 (Windows NT 10.0)'), false);
});

const apk = new URL(`../../../mobile/artifacts/${ANDROID_APP.filename}`, import.meta.url);
test('published release metadata matches the signed APK when the build artifact is available', { skip: !existsSync(apk) }, () => {
  const file = readFileSync(apk);
  assert.equal(file.length, ANDROID_APP.bytes);
  assert.equal(createHash('sha256').update(file).digest('hex'), ANDROID_APP.sha256);
});
