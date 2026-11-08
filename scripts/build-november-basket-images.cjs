const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourcePath = process.argv[2] || path.join(root, '.private', 'november-source-workbook.json');
const catalogPath = process.argv[3] || path.join(root, '.private', 'november-db-products.json');
const outputDir = path.join(root, 'apps', 'web', 'public', 'assets', 'baskets', '2026-11');
const cacheDir = path.join(root, '.private', 'november-product-image-cache');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const products = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const font = fs.readFileSync(path.join(root, 'apps', 'web', 'public', 'fonts', 'Vazirmatn-Bold.ttf')).toString('base64');
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const bySku = new Map();
for (const product of products) {
  for (const key of [product.sku, product.product_id]) {
    if (!key) continue;
    const entries = bySku.get(key) || [];
    if (!entries.includes(product)) entries.push(product);
    bySku.set(key, entries);
  }
}
function cleanSku(value) {
  const raw = String(value || '').trim();
  return /e[+\-]?\d+/i.test(raw) ? String(Math.round(Number(raw))) : raw;
}
function findProduct(sku) {
  const raw = cleanSku(sku);
  for (const key of [raw, `0${raw}`, `00${raw}`, raw.startsWith('0') ? raw.slice(1) : raw]) {
    const rows = bySku.get(key) || [];
    const hit = rows.find((p) => !p.deleted_at && p.status === 'active' && p.image_url);
    if (hit) return hit;
  }
  return null;
}
async function photo(product) {
  const key = String(product.id);
  const cached = path.join(cacheDir, `${key}.img`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached);
  const url = product.image_url.startsWith('http') ? product.image_url : `https://tamasmarket.com${product.image_url}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image HTTP ${response.status}: ${product.sku}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(cached, bytes);
  return bytes;
}
function overlay(brand, label, count) {
  const en = brand === 'oxygen' ? 'OXYGEN' : brand === 'glass' ? 'GLASS' : 'YESIDO';
  const subtitle = brand === 'glass' ? 'سبد گلس' : brand === 'oxygen' ? 'سبد اکسیژن' : `سبد یسیدو ${label}`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
    <style>@font-face{font-family:Vazirmatn;src:url(data:font/ttf;base64,${font}) format('truetype')}</style>
    <rect width="1024" height="1024" fill="#f3f5f3"/>
    <circle cx="975" cy="35" r="235" fill="#dcefeb"/>
    <rect x="0" y="865" width="1024" height="159" fill="#113f3b"/>
    <rect x="48" y="43" width="13" height="78" rx="6" fill="#ee6428"/>
    <text x="85" y="103" font-family="Vazirmatn" font-size="69" font-weight="bold" fill="#113f3b">${en}</text>
    <text x="512" y="942" direction="rtl" text-anchor="middle" font-family="Vazirmatn" font-size="70" font-weight="bold" fill="#fff">${subtitle} · ${count} قلم</text>
    <text x="512" y="1002" direction="rtl" text-anchor="middle" font-family="Vazirmatn" font-size="30" fill="#bed4cf">نمایی از اقلام داخل سبد</text>
  </svg>`);
}
async function build(spec) {
  const rows = spec.tab === 'Glass Basket'
    ? products.filter((p) => !p.deleted_at && p.status === 'active' && p.image_url && /محافظ صفحه|گلس/.test(p.title || '')).slice(0, 60)
    : source[spec.tab].slice(1).map((row) => ({ row, product: findProduct(row[0]) })).filter((entry) => entry.product);
  let selected;
  if (spec.tab === 'Glass Basket') selected = [rows[0], rows[4], rows[6], rows[10], rows[15], rows[36]].filter(Boolean);
  else selected = spec.indexes.map((i) => rows[i]?.product).filter(Boolean);
  if (selected.length !== 6) throw new Error(`${spec.tab}: expected 6 photos, got ${selected.length}`);
  const cards = [];
  for (let i = 0; i < 6; i++) {
    const bytes = await photo(selected[i]);
    const x = 42 + (i % 3) * 315;
    const y = 149 + Math.floor(i / 3) * 346;
    const card = await sharp(bytes).resize(290, 290, { fit: 'contain', background: '#fff' }).webp({ quality: 85 }).toBuffer();
    const edge = Buffer.from('<svg width="294" height="294"><rect x="1" y="1" width="292" height="292" rx="18" fill="#fff" stroke="#d9e1de" stroke-width="2"/></svg>');
    cards.push({ input: edge, left: x - 2, top: y - 2 }, { input: card, left: x, top: y });
  }
  const background = overlay(spec.brand, spec.label, spec.count);
  const file = path.join(outputDir, `${spec.file}.webp`);
  await sharp(background).composite(cards).webp({ quality: 90 }).toFile(file);
  console.log(`${spec.file}.webp: ${selected.map((p) => p.sku).join(', ')}`);
}

const specs = [
  { tab: 'Yesido 1', brand: 'yesido', label: '۱', count: 65, file: 'yesido-1', indexes: [0, 4, 7, 16, 34, 56] },
  { tab: 'Yesido 2', brand: 'yesido', label: '۲', count: 68, file: 'yesido-2', indexes: [0, 4, 8, 20, 40, 59] },
  { tab: 'Yesido 3', brand: 'yesido', label: '۳', count: 70, file: 'yesido-3', indexes: [0, 5, 12, 25, 42, 60] },
  { tab: 'Yesido 4', brand: 'yesido', label: '۴', count: 69, file: 'yesido-4', indexes: [1, 6, 15, 28, 45, 59] },
  { tab: 'Yesido 5', brand: 'yesido', label: '۵', count: 66, file: 'yesido-5', indexes: [0, 5, 9, 21, 39, 56] },
  { tab: 'Yesido Gadget', brand: 'yesido', label: 'گجت', count: 26, file: 'yesido-gadget', indexes: [0, 2, 6, 12, 17, 24] },
  { tab: 'Oxygen Basket', brand: 'oxygen', label: '', count: 119, file: 'oxygen', indexes: [0, 6, 12, 24, 38, 51] },
  { tab: 'Glass Basket', brand: 'glass', label: '', count: 350, file: 'glass', indexes: [] },
];
(async () => { for (const spec of specs) await build(spec); })().catch((error) => { console.error(error); process.exitCode = 1; });
