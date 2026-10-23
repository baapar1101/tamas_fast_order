import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { notifyAppUpdate, subscribeAppUpdates } from '../src/lib/forceAppUpdate';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('updates notify the UI without refreshing an unfinished form', () => {
  const values: number[] = [];
  const unsubscribe = subscribeAppUpdates((build) => values.push(build));
  notifyAppUpdate(42);
  assert.equal(values.at(-1), 42);
  unsubscribe();
  notifyAppUpdate(43);
  assert.equal(values.at(-1), 42);
  const source = read('../src/lib/forceAppUpdate.ts');
  const polling = source.slice(source.indexOf('export async function checkForAppUpdate'));
  assert.doesNotMatch(polling, /await forceReloadLatestApp/);
  assert.match(source, /name\.startsWith\('tamas-'\)/);
});

test('all admin pages load on demand inside a shared loading boundary', () => {
  const app = read('../src/admin/AdminApp.tsx');
  assert.doesNotMatch(app, /import \{ \w+Page \} from '\.\/pages\//);
  assert.match(app, /<Suspense fallback=/);
  assert.match(read('../src/main.tsx'), /styles\/platform-ui\.css/);
});

test('private profile attachments use an upload rather than arbitrary public links', () => {
  assert.match(read('../src/storefront/AuthDialog.tsx'), /<PrivateUploadField/);
  const field = read('../src/components/PrivateUploadField.tsx');
  assert.match(field, /aria-describedby=/);
  assert.match(field, /aria-invalid=/);
  assert.match(field, /\/api\/files\//);
});

test('shared dialog sizes stay bounded and every theme maps shared semantic surfaces', () => {
  const css = read('../src/styles/platform-ui.css');
  assert.match(css, /--ds-surface: var\(--ds-admin-surface\)/);
  assert.match(css, /--modal-size: 28rem/);
  assert.match(css, /max-width: min\(var\(--modal-size/);
  assert.match(css, /body \.wallet-panel input \{[^}]*background: var\(--ds-surface-subtle\)/);
  assert.match(css, /Prevent focus-induced zoom on iOS/);
});
