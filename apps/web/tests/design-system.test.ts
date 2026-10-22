import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativeUrl: string) => readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');

test('the design system loads before compatibility styles', () => {
  const main = read('../src/main.tsx');
  const designSystemIndex = main.indexOf("./styles/design-system.css");
  const globalIndex = main.indexOf("./styles/global.css");

  assert.ok(designSystemIndex >= 0, 'design-system.css must be imported');
  assert.ok(globalIndex > designSystemIndex, 'compatibility styles must load after the design system tokens');
});

test('the shared design system defines every required semantic contract', () => {
  const css = read('../src/styles/design-system.css');
  const requiredTokens = [
    '--ds-canvas', '--ds-surface', '--ds-text', '--ds-text-muted', '--ds-border',
    '--ds-interactive', '--ds-success', '--ds-warning', '--ds-danger', '--ds-info',
    '--ds-focus-ring', '--ds-control-h-md', '--ds-radius-md', '--ds-shadow-md',
    '--ds-admin-surface', '--ds-admin-text', '--ds-admin-interactive', '--ds-admin-focus-ring',
  ];
  const requiredPrimitives = [
    '.ds-page', '.ds-container', '.ds-surface', '.ds-button', '.ds-field',
    '.ds-control', '.ds-badge', '.ds-alert', '.ds-table-wrap', '.toast-host',
  ];

  for (const token of requiredTokens) assert.ok(css.includes(token), `missing token ${token}`);
  for (const primitive of requiredPrimitives) assert.ok(css.includes(primitive), `missing primitive ${primitive}`);
});

test('storefront and admin legacy APIs are adapters over ds semantic tokens', () => {
  const globalCss = read('../src/styles/global.css');
  const adminTheme = read('../src/admin/theme.css');
  const adminFoundation = read('../src/admin/foundation.css');

  assert.match(globalCss, /--tamas-bg:\s*var\(--ds-canvas\)/);
  assert.match(globalCss, /--tamas-accent:\s*var\(--ds-interactive\)/);
  assert.match(adminTheme, /--a-brand:\s*var\(--ds-admin-interactive\)/);
  assert.match(adminTheme, /--a-surface:\s*var\(--ds-admin-surface\)/);
  assert.match(adminFoundation, /--a-control-h:\s*var\(--ds-control-h-md\)/);
  assert.doesNotMatch(globalCss, /\*\s*\{[^}]*outline:\s*none/s, 'global focus outlines must not be disabled');
});
