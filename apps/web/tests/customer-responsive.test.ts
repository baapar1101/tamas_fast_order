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

test('mobile filter card delegates vertical swipes to the page', () => {
  const css = read('../src/storefront/customer-responsive.css');

  assert.match(css, /@media \(max-width:\s*1024px\)[\s\S]*?\.layout\s*>\s*\.sidebar\s*\{[^}]*max-height:\s*none/s);
  assert.match(css, /\.layout\s*>\s*\.sidebar\s*\{[^}]*overflow-y:\s*visible/s);
  assert.match(css, /\.layout\s*>\s*\.sidebar\s*\{[^}]*overscroll-behavior:\s*auto/s);
});

test('account modules and very narrow screens have explicit overflow contracts', () => {
  const css = read('../src/storefront/customer-responsive.css');

  assert.match(css, /\.account-content\s*\{[^}]*container:\s*customer-account\s*\/\s*inline-size/s);
  assert.match(css, /@container customer-account \(max-width:\s*760px\)/);
  assert.match(css, /@media \(max-width:\s*380px\)/);
  assert.match(css, /overflow-x:\s*clip/);
});

test('mobile product imagery owns a dedicated grid area instead of overlapping product copy', () => {
  const card = read('../src/storefront/ProductCard.tsx');
  const storefrontCss = read('../src/storefront/storefront.css');

  assert.match(card, /className="product-card-content"/);
  assert.match(storefrontCss, /\.product-card\s*>\s*div\.catalog-image-gallery--grid\s*\{[^}]*grid-area:\s*thumb/s);
  assert.match(storefrontCss, /\.product-card\s*>\s*\.product-card-content\s*\{[^}]*grid-area:\s*body/s);
  assert.doesNotMatch(storefrontCss, /\.product-card\s*>\s*div:not\(\.card-price-box\)/);
});

test('account routes keep the shared mobile app navigation', () => {
  const accountLayout = read('../src/storefront/AccountLayout.tsx');
  const storefront = read('../src/storefront/StorefrontPage.tsx');
  const navigation = read('../src/storefront/MobileAppNavigation.tsx');
  const css = read('../src/storefront/customer-responsive.css');

  assert.match(accountLayout, /<MobileAppNavigation\s+activeTab="profile"/);
  assert.match(accountLayout, /categories:\s*'\/\?tab=categories'/);
  assert.match(storefront, /parseMobileTab\(searchParams\.get\('tab'\)\)/);
  assert.match(navigation, /aria-label="ناوبری اصلی فروشگاه"/);
  assert.match(css, /\.account-shell\s*\{[^}]*padding-bottom:\s*calc\(68px\s*\+\s*env\(safe-area-inset-bottom/s);
});

test('catalog previews reuse the accessible shared dialog rather than a click-only overlay', () => {
  const preview = read('../src/storefront/ProductImagePreview.tsx');
  const storefront = read('../src/storefront/StorefrontPage.tsx');
  const product = read('../src/storefront/ProductPage.tsx');

  assert.match(preview, /import \{ Modal \} from/);
  assert.match(preview, /<Modal open=\{Boolean\(src\)\} title=/);
  assert.match(preview, /alt="تصویر بزرگ محصول"/);
  assert.match(storefront, /<ProductImagePreview src=\{preview\}/);
  assert.match(product, /<ProductImagePreview src=\{relatedPreview\}/);
});
