const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.private/november-campaign-partial-manifest.json'), 'utf8'));
const products = JSON.parse(fs.readFileSync(path.join(root, '.private/current-products.json'), 'utf8'));
const outputDir = path.join(root, 'apps/web/public/assets/baskets/2026-11');
const font = fs.readFileSync(path.join(root, 'apps/web/public/fonts/Vazirmatn-Bold.ttf')).toString('base64');
const byCode = new Map();
for (const product of products.filter((row) => !row.deleted_at && row.status === 'active')) {
  for (const value of [product.product_id, product.sku]) if (value) byCode.set(value.replace(/^0+/, ''), product);
}
const files = {
  '09999990002': 'yesido-1', '09999990003': 'yesido-2', '09999990004': 'yesido-3',
  '09999990005': 'yesido-4', '09999990006': 'yesido-5', '09999990007': 'yesido-gadget',
  '09999990008': 'oxygen',
};
const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const sourceCache = new Map();
async function image(url) {
  if (!sourceCache.has(url)) {
    const full = new URL(url, 'https://tamasmarket.com').href;
    const response = await fetch(full);
    if (!response.ok) throw new Error(`Product image ${response.status}: ${full}`);
    sourceCache.set(url, Buffer.from(await response.arrayBuffer()));
  }
  return sourceCache.get(url);
}
function background(basket, selectedCount) {
  const brand = basket.title.includes('اکسیژن') ? 'OXYGEN' : 'YESIDO';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
    <style>@font-face{font-family:Vazirmatn;src:url(data:font/ttf;base64,${font}) format('truetype')}</style>
    <rect width="900" height="900" fill="#f7faf9"/>
    <rect x="0" y="0" width="900" height="130" fill="#123f40"/>
    <rect x="45" y="39" width="11" height="60" rx="5" fill="#f26727"/>
    <text x="81" y="89" font-size="58" font-weight="bold" fill="#fff" font-family="Vazirmatn">${brand}</text>
    <rect x="0" y="795" width="900" height="105" fill="#123f40"/>
    <text x="450" y="851" text-anchor="middle" direction="rtl" font-size="42" font-weight="bold" fill="#fff" font-family="Vazirmatn">${escapeXml(basket.title)}</text>
    <text x="450" y="884" text-anchor="middle" direction="rtl" font-size="22" fill="#cce7e2" font-family="Vazirmatn">${fa(basket.units)} عدد · ${fa(selectedCount)} مدل · نمایی از اقلام داخل سبد</text>
    <rect x="43" y="151" width="393" height="301" rx="22" fill="#fff" stroke="#dae7e3" stroke-width="3"/>
    <rect x="464" y="151" width="393" height="301" rx="22" fill="#fff" stroke="#dae7e3" stroke-width="3"/>
    <rect x="43" y="472" width="393" height="301" rx="22" fill="#fff" stroke="#dae7e3" stroke-width="3"/>
    <rect x="464" y="472" width="393" height="301" rx="22" fill="#fff" stroke="#dae7e3" stroke-width="3"/>
  </svg>`);
}
async function build(basket) {
  const resolved = basket.lines.map((line) => ({ ...line, product: byCode.get(line.sku.replace(/^0+/, '')) ?? null }));
  const imageLines = resolved.filter((line) => line.product?.image_url);
  if (imageLines.length < 20) throw new Error(`${basket.sku}: not enough exact item images`);
  const positions = basket.sku === '09999990007'
    ? [0, Math.floor(imageLines.length / 3), imageLines.findIndex((line) => line.sku === '10010100006'), imageLines.length - 1]
    : [0, Math.floor(imageLines.length / 3), Math.floor(imageLines.length * 2 / 3), imageLines.length - 1];
  const cells = [[62, 171], [483, 171], [62, 492], [483, 492]];
  const composite = [];
  for (let i = 0; i < 4; i++) {
    const line = imageLines[positions[i]];
    const source = await image(line.product.image_url);
    const normalized = await sharp(source).resize(355, 261, { fit: 'contain', background: '#fff' }).png().toBuffer();
    composite.push({ input: normalized, left: cells[i][0], top: cells[i][1] });
  }
  const file = `${files[basket.sku]}-full.webp`;
  await sharp(background(basket, basket.lines.length)).composite(composite).webp({ quality: 90 }).toFile(path.join(outputDir, file));
  const gallery = [...new Set([
    ...(basket.sku === '09999990007' ? [imageLines.find((line) => line.sku === '10010100006')?.product.image_url] : []),
    ...Array.from({ length: 12 }, (_, i) => imageLines[Math.min(imageLines.length - 1, Math.floor(i * imageLines.length / 12))].product.image_url),
  ].filter(Boolean))].slice(0, 12);
  const bundleItems = resolved.map((line) => ({ productId: line.product?.product_id ?? line.sku, qty: line.qty }));
  const description = `اقلام ${basket.title} (مجموع ${fa(basket.units)} عدد، ${fa(basket.lines.length)} مدل):\n` +
    resolved.map((line, i) => `${fa(i + 1)}. ${line.title} — کد ${line.product?.product_id ?? line.sku} — ${fa(line.qty)} عدد`).join('\n');
  return { sku: basket.sku, imageUrl: `/uploads/product/2026-11/${file}`, gallery, bundleItems, description, missingImages: resolved.filter((line) => !line.product?.image_url).map((line) => line.sku) };
}
(async () => {
  const output = [];
  for (const basket of manifest.baskets.filter((basket) => files[basket.sku])) output.push(await build(basket));
  fs.writeFileSync(path.join(root, '.private/november-basket-enhancements.json'), JSON.stringify(output, null, 2));
  console.log(output.map(({ sku, imageUrl, gallery, bundleItems, missingImages }) => ({ sku, imageUrl, gallery: gallery.length, items: bundleItems.length, missingImages })));
})().catch((error) => { console.error(error); process.exitCode = 1; });
