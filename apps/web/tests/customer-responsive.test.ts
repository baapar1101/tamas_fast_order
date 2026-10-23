import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativeUrl: string) => readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');

test('customer responsive guardrails load after customer page modules', () => {
  const app = read('../src/App.tsx');
  const responsiveImport = app.indexOf("./storefront/customer-responsive.css");
  const lastCustomerModule = app.indexOf("./storefront/TelegramConnectPrompt");

  assert.ok(responsiveImport > lastCustomerModule, 'customer responsive CSS must be the final customer-facing compatibility layer');
});

test('storefront toolbar follows its own column width', () => {
  const css = read('../src/storefront/customer-responsive.css');

  assert.match(css, /\.main-content\s*\{[^}]*container:\s*product-results\s*\/\s*inline-size/s);
  assert.match(css, /@container product-results \(max-width:\s*700px\)/);
  assert.match(css, /@container product-results \(max-width:\s*500px\)/);
  assert.match(css, /\.toolbar-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test('account modules and very narrow screens have explicit overflow contracts', () => {
  const css = read('../src/storefront/customer-responsive.css');

  assert.match(css, /\.account-content\s*\{[^}]*container:\s*customer-account\s*\/\s*inline-size/s);
  assert.match(css, /@container customer-account \(max-width:\s*760px\)/);
  assert.match(css, /@media \(max-width:\s*380px\)/);
  assert.match(css, /overflow-x:\s*clip/);
});
