/** Read-only deployment checks. Quotes do not create orders or transactions. */
import assert from 'node:assert/strict';

const base = (process.argv[2] || 'https://tamasmarket.com').replace(/\/$/, '');
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, ok: true }); }
  catch (error) { results.push({ name, ok: false, error: error.message }); }
}
async function json(path, options) {
  const response = await fetch(`${base}/api${path}`, options);
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
}

await check('public settings exclude integration credentials and internal configuration', async () => {
  const data = await json(`/catalog/bootstrap?audit=${Date.now()}`);
  const allowed = new Set(['store_name', 'store_tagline', 'support_phone', 'store_address', 'hero_image', 'currency', 'api_version', 'storefront_filters', 'payment_methods']);
  assert.ok(Object.keys(data.settings).every((key) => allowed.has(key)));
});

for (const sort of ['price_asc', 'price_desc', 'newest']) {
  await check(`global ${sort} ordering across page boundaries and normalized product JSON`, async () => {
    const pages = await Promise.all([1, 2].map((page) => json(`/catalog/products?inStock=true&sort=${sort}&page=${page}&perPage=24&audit=${Date.now()}`)));
    const groups = pages.flatMap((page) => page.groups);
    assert.ok(groups.length > 24, 'at least two populated pages are required');
    assert.equal(new Set(groups.map((group) => group.key)).size, groups.length);
    const values = groups.map((group) => sort === 'newest'
      ? Math.max(...group.variants.map((variant) => Date.parse(variant.createdAt)))
      : group.minPrice);
    assert.ok(values.every((value, index) => index === 0 || (sort === 'price_asc' ? values[index - 1] <= value : values[index - 1] >= value)));
    for (const group of groups) for (const product of group.variants) {
      assert.ok(Array.isArray(product.gallery));
      assert.ok(Array.isArray(product.attributes));
      assert.ok(Array.isArray(product.bundleItems));
    }
  });
}

for (const path of ['/admin/settings', '/admin/users', '/admin/orders', '/orders', '/wallet']) {
  await check(`anonymous access denied: ${path}`, async () => {
    const response = await fetch(`${base}/api${path}`);
    assert.equal(response.status, 401);
  });
}

await check('malformed JSON is a client error', async () => {
  const response = await fetch(`${base}/api/payment/terms/quote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'bad_request');
});

await check('cash payment retains non-mobile discount', async () => {
  const catalog = await json('/catalog/products?inStock=true&sort=price_asc&perPage=24');
  const product = catalog.groups.flatMap((group) => group.variants).find((item) => item.categoryName !== 'Mobile phones' && item.price > 0);
  assert.ok(product);
  const quote = await json('/payment/terms/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ productId: product.productId, qty: 1 }] }) });
  const cash = quote.plans.find((plan) => plan.kind === 'cash');
  assert.ok(cash);
  assert.equal(cash.finalAmount, cash.baseAmount - Math.round(cash.baseAmount * cash.discountPercent / 100));
});

console.log(JSON.stringify({ base, results, passed: results.filter((result) => result.ok).length, total: results.length }, null, 2));
if (results.some((result) => !result.ok)) process.exitCode = 1;
