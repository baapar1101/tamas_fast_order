const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, '.private/november-source-workbook.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, '.private/november-db-products.json'), 'utf8'));
const priceFile = path.join(root, '.private/november-campaign-prices.json');
const addedPrices = fs.existsSync(priceFile) ? JSON.parse(fs.readFileSync(priceFile, 'utf8')) : {};
const active = catalog.filter((p) => !p.deleted_at && p.status === 'active');
const bySku = new Map();
for (const item of active) {
  for (const key of [item.sku, item.product_id]) {
    if (!key) continue;
    const matches = bySku.get(key) || [];
    matches.push(item);
    bySku.set(key, matches);
  }
}
const plain = (value) => String(value ?? '').replace(/[\u064a\u0643]/g, (x) => x === 'ي' ? 'ی' : 'ک').replace(/[\u200b-\u200d]/g, '').replace(/\s+/g, ' ').trim();
const rawSku = (value) => {
  const raw = String(value ?? '').trim();
  return /e[+-]?\d+/i.test(raw) ? String(Math.round(Number(raw))) : raw;
};
function findProduct(value) {
  const sku = rawSku(value);
  for (const key of [sku, `0${sku}`, `00${sku}`, sku.startsWith('0') ? sku.slice(1) : sku]) {
    const match = bySku.get(key)?.find((p) => p.image_url && Number(p.price) > 0);
    if (match) return match;
  }
  return null;
}
function validPrice(value) {
  const n = Number(String(value ?? '').replace(/[\s,،]/g, ''));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
const newSpec = {
  '02040100054': [25, 13, 'مشکی'], '10010100006': [6, 13, 'مشکی'],
  '02030100514': [12, 13, 'سفید'], '02030500094': [11, 13, 'مشکی'],
  '02020300103': [19, 22, 'طوسی'], '02030100445': [12, 22, 'سفید'],
  '02040100031': [25, 17, 'طوسی'], '08010100013': [21, 17, 'مشکی و بنفش'],
  '02030100394': [12, 27, 'سفید'], '02030100392': [12, 27, 'سفید'],
  '02030600007': [13, 17, 'مشکی'], '01020100133': [5, 27, 'مشکی'],
  '02030500083': [11, 4, 'سفید'], '02020400061': [10, 27, 'مشکی'],
  '02020400049': [10, 17, 'مشکی'],
};
const illustrative = new Set(['02030100514', '02030100445', '02030100394', '02030500083']);

const singles = source['Tak kala'].slice(1).filter((r) => r[0]).map((row) => {
  const sku = rawSku(row[0]);
  const site = findProduct(sku);
  const stock = Number(row[2]);
  if (!Number.isSafeInteger(stock) || stock < 0) throw new Error(`Bad Tak kala stock: ${sku}`);
  if (!site && !newSpec[sku]) throw new Error(`Unplanned new SKU: ${sku}`);
  const price = site ? validPrice(site.price) : validPrice(addedPrices[sku]);
  return {
    sku, title: plain(row[1]), stock, price, existingId: site?.id ?? null,
    imageUrl: site?.image_url ?? `/uploads/product/2026-11/${sku}.webp`,
    categoryId: site ? null : newSpec[sku][0], brandId: site ? null : newSpec[sku][1],
    color: site ? null : newSpec[sku][2], illustrative: illustrative.has(sku),
  };
});
if (singles.length !== 330 || new Set(singles.map((s) => s.sku)).size !== 330) throw new Error('Tak kala SKU count changed');
const bySingle = new Map(singles.map((s) => [s.sku, s]));
const toPersian = (n) => String(n).replace(/\d/g, (x) => '۰۱۲۳۴۵۶۷۸۹'[Number(x)]);

const basketSpec = [
  ['Yesido 1', '09999990002', 'سبد یسیدو ۱', 'yesido-1', 1],
  ['Yesido 2', '09999990003', 'سبد یسیدو ۲', 'yesido-2', 1],
  ['Yesido 3', '09999990004', 'سبد یسیدو ۳', 'yesido-3', 1],
  ['Yesido 4', '09999990005', 'سبد یسیدو ۴', 'yesido-4', 1],
  ['Yesido 5', '09999990006', 'سبد یسیدو ۵', 'yesido-5', 1],
  ['Yesido Gadget', '09999990007', 'سبد گجت یسیدو', 'yesido-gadget', 1],
  ['Oxygen Basket', '09999990008', 'سبد اکسیژن', 'oxygen', 3],
];
const baskets = basketSpec.map(([tab, sku, title, image, stock]) => {
  const lines = source[tab].slice(1).filter((r) => r[0] && Number(r[3]) > 0).map((r) => {
    const component = findProduct(r[0]);
    const single = bySingle.get(rawSku(r[0]));
    const unitPrice = component ? validPrice(component.price) : single?.price ?? null;
    if (!unitPrice && !single) throw new Error(`${tab}: unmatched SKU ${r[0]}`);
    return { sku: single?.sku ?? component?.sku ?? rawSku(r[0]), title: plain(r[1]), qty: Number(r[3]), unitPrice, siteId: component?.id ?? null };
  });
  const units = lines.reduce((sum, line) => sum + line.qty, 0);
  const price = lines.every((l) => l.unitPrice) ? lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0) : null;
  const description = `اقلام سبد (مجموع ${toPersian(units)} عدد):\n` + lines.map((l, i) => `${toPersian(i + 1)}. ${l.title} — ${toPersian(l.qty)} عدد`).join('\n');
  return { tab, sku, title, stock, price, categoryId: 3, type: 'physical', imageUrl: `/uploads/product/2026-11/${image}.webp`, units, lines, description };
});

const adapterRows = source['adapter basket 1'].slice(2).filter((r) => Number(r[1]) > 0 && !plain(r[0]).startsWith('جمع'));
const adapterPrice = adapterRows.reduce((sum, r) => sum + Number(r[4]), 0);
const adapterNormal = adapterRows.reduce((sum, r) => sum + Number(r[1]) * Number(r[2]), 0);
const adapterUnits = adapterRows.reduce((sum, r) => sum + Number(r[1]), 0);
const adapterDescription = `اقلام سبد (مجموع ${toPersian(adapterUnits)} عدد):\n` + adapterRows.map((r, i) => `${toPersian(i + 1)}. ${plain(r[0])} — ${toPersian(Number(r[1]))} عدد`).join('\n');
const existingBaskets = [{ sku: '02030200151', price: adapterPrice, oldPrice: adapterNormal, stock: 10, description: adapterDescription }];
for (let i = 1; i <= 4; i++) {
  const rows = source[`Cover ${i} Basket`].slice(2).filter((r) => Number(r[2]) > 0 && !plain(r[0]).startsWith('جمع'));
  const sku = ['02010104586', '02010104585', '02010104587', '02010104588'][i - 1];
  const site = findProduct(sku);
  if (!site) throw new Error(`Missing cover basket ${sku}`);
  const price = rows.reduce((sum, r) => sum + Number(r[4]), 0);
  const units = rows.reduce((sum, r) => sum + Number(r[2]), 0);
  const description = `اقلام سبد (مجموع ${toPersian(units)} عدد):\n` + rows.map((r, j) => `${toPersian(j + 1)}. ${plain(site.title)} مدل ${plain(r[1])} — ${toPersian(Number(r[2]))} عدد`).join('\n');
  existingBaskets.push({ sku, price, stock: Number(site.stock), description });
}
const glassRows = source['Glass Basket'].slice(2).filter((r) => Number(r[2]) > 0 && !plain(r[0]).startsWith('جمع'));
const glassPrice = glassRows.reduce((sum, r) => sum + Number(r[6]), 0);
const glassNormal = glassRows.reduce((sum, r) => sum + Number(r[2]) * Number(r[4]), 0);
const glassUnits = glassRows.reduce((sum, r) => sum + Number(r[2]), 0);
const glassDescription = `اقلام سبد (مجموع ${toPersian(glassUnits)} عدد):\n` + glassRows.map((r, i) => `${toPersian(i + 1)}. گلس ${plain(r[3])} برای ${plain(r[0])}: ${plain(r[1])} — ${toPersian(Number(r[2]))} عدد`).join('\n');
baskets.push({ tab: 'Glass Basket', sku: '09999990009', title: 'سبد ۳۵۰ تایی گلس', stock: 7, price: glassPrice, oldPrice: glassNormal, categoryId: 3, type: 'physical', imageUrl: '/uploads/product/2026-11/glass.webp', units: glassUnits, lineCount: glassRows.length, lines: [], description: glassDescription });

if (adapterPrice !== 53030000 || glassPrice !== 43434700 || glassUnits !== 350) throw new Error('Workbook basket totals changed');
for (const b of baskets) if (catalog.some((p) => !p.deleted_at && (p.sku === b.sku || p.product_id === b.sku))) throw new Error(`New basket SKU already exists: ${b.sku}`);
const selected = new Set([...singles.map((p) => p.existingId), ...existingBaskets.map((b) => findProduct(b.sku)?.id)].filter(Boolean));
const report = {
  source: 'Tak kala and named basket tabs, 16 nist campaign - TamasMarket.xlsx',
  singles, baskets, existingBaskets,
  pendingPrices: singles.filter((s) => !s.price).map(({ sku, title }) => ({ sku, title })),
  selectedExistingIds: [...selected],
  otherStockedCount: active.filter((p) => !selected.has(p.id) && Number(p.stock) > 0).length,
};
fs.writeFileSync(path.join(root, '.private/november-campaign-manifest.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ singles: singles.length, pendingPrices: report.pendingPrices.length, baskets: baskets.map(({ sku, price, stock, units }) => ({ sku, price, stock, units })), existingBaskets: existingBaskets.map(({ sku, price, stock }) => ({ sku, price, stock })), otherStockedCount: report.otherStockedCount }, null, 2));
