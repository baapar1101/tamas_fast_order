const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'apps/web/public/assets/slides');
const fontBold = fs.readFileSync(path.join(root, 'apps/web/public/fonts/Vazirmatn-Bold.ttf')).toString('base64');
const fontRegular = fs.readFileSync(path.join(root, 'apps/web/public/fonts/Vazirmatn-Regular.ttf')).toString('base64');
const specs = [
  {
    name: 'singles', title: 'جشنواره این ماه', subtitle: 'کالاهای تک‌قلم منتخب',
    line: 'کالاهای آماده خرید با موجودی محدود', button: 'مشاهده کالاها',
    tag: 'TAK KALA',
    images: [
      '/uploads/product/2026-10/7e2b30a6-462e-4f2f-82fe-886647918161.webp',
      '/uploads/product/2026-10/53763908-f43d-458b-b8a3-8030153cecc0.webp',
      '/uploads/product/2026-10/02d42c25-6289-4da7-81ed-8c01100ecc99.webp',
    ],
    labels: ['YESIDO', 'OXYGEN', 'BOROFONE'],
  },
  {
    name: 'baskets', title: 'سبدهای جشنواره', subtitle: 'گارد · آداپتور · گلس',
    line: 'سبدهای آماده خرید برای همکاران', button: 'مشاهده سبدها',
    tag: 'BASKETS',
    images: [
      '/uploads/product/2026-10/4c7f602c-6874-4f49-9269-192215153182.webp',
      '/uploads/product/2026-10/4dd1f297-883e-49d1-9108-aeac3ee02a27.webp',
      '/uploads/product/2026-11/glass.webp',
    ],
    labels: ['آداپتور', 'گارد', 'گلس'],
  },
];

const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const svg = (content, width, height) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>
  @font-face{font-family:Vazirmatn;src:url(data:font/ttf;base64,${fontBold}) format('truetype');font-weight:700}
  @font-face{font-family:Vazirmatn;src:url(data:font/ttf;base64,${fontRegular}) format('truetype');font-weight:400}
  text{font-family:Vazirmatn}
  </style>${content}</svg>`);
const text = (value, x, y, size, color = '#161616', weight = 700, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" direction="rtl">${esc(value)}</text>`;

async function photo(url) {
  const response = await fetch(`https://tamasmarket.com${url}`);
  if (!response.ok) throw new Error(`Image unavailable: ${url} ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function render(spec, mobile) {
  const W = mobile ? 1200 : 2000;
  const H = mobile ? 600 : 500;
  const textX = mobile ? 365 : 345;
  const positions = mobile
    ? [[636, 168, 170], [820, 92, 200], [1016, 168, 170]]
    : [[755, 135, 240], [1030, 68, 300], [1360, 135, 240]];
  const cards = positions.map(([x, y, s]) => `<rect x="${x - 12}" y="${y - 12}" width="${s + 24}" height="${s + 24}" rx="24" fill="#fff" stroke="#e6e7e8" stroke-width="3"/>`).join('');
  const darkWave = mobile
    ? `<path d="M800 600 C940 530 1090 525 1200 460 L1200 600Z" fill="#191515"/><path d="M930 600 C1050 558 1140 575 1200 589 L1200 600Z" fill="#057f97"/>`
    : `<path d="M1300 500 C1470 415 1660 445 1810 420 C1900 402 1960 385 2000 365 L2000 500Z" fill="#191515"/><path d="M1550 500 C1685 455 1880 470 2000 490 L2000 500Z" fill="#057f97"/>`;
  const background = svg(`
    <rect width="${W}" height="${H}" fill="#fff"/>
    <path d="M${mobile ? 160 : 230} 40 L${mobile ? 160 : 230} ${H - 175} L${mobile ? 335 : 370} ${H - 175} L${mobile ? 335 : 370} ${H - 40} L${mobile ? 110 : 125} ${H - 300}Z" fill="#f0f0f1"/>
    <rect x="${mobile ? 565 : 690}" y="${mobile ? 65 : 49}" width="${mobile ? 600 : 1060}" height="${mobile ? 435 : 368}" rx="42" fill="#fafafa" stroke="#ececec" stroke-width="3"/>
    ${cards}${darkWave}`, W, H);
  const layers = [{ input: background, left: 0, top: 0 }];
  for (let i = 0; i < positions.length; i++) {
    const [x, y, s] = positions[i];
    const p = await photo(spec.images[i]);
    const normalized = await sharp(p).resize(s, s, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
    layers.push({ input: normalized, left: x, top: y });
  }
  const labelY = mobile ? 470 : 402;
  let labels = '';
  for (let i = 0; i < positions.length; i++) {
    const [x, , s] = positions[i];
    labels += `<rect x="${x - 10}" y="${labelY - 34}" width="${s + 20}" height="46" rx="12" fill="#fff" stroke="#0b8198" stroke-width="3"/>
      ${text(spec.labels[i], x + s / 2, labelY - 2, mobile ? 26 : 24, '#152c34', 700, 'middle')}`;
  }
  const overlay = svg(`
    ${labels}
    <rect x="${mobile ? 75 : 70}" y="${mobile ? 208 : 171}" width="10" height="${mobile ? 83 : 72}" rx="5" fill="#f46226"/>
    ${text(spec.title, textX, mobile ? 134 : 102, mobile ? 62 : 55, '#171717', 700, 'middle')}
    ${text(spec.subtitle, textX, mobile ? 269 : 230, mobile ? 44 : 43, '#171717', 700, 'middle')}
    ${text(spec.line, textX, mobile ? 355 : 324, mobile ? 27 : 29, '#323232', 400, 'middle')}
    <path d="M${mobile ? 96 : 100} ${mobile ? 359 : 340} Q${mobile ? 70 : 65} ${mobile ? 405 : 385} ${mobile ? 126 : 120} ${mobile ? 430 : 410}" fill="none" stroke="#171717" stroke-width="4" stroke-linecap="round"/>
    <rect x="${mobile ? 113 : 148}" y="${mobile ? 434 : 389}" width="${mobile ? 420 : 342}" height="${mobile ? 82 : 68}" rx="8" fill="#f46226"/>
    ${text(spec.button, mobile ? 323 : 314, mobile ? 491 : 437, mobile ? 43 : 35, '#fff', 700, 'middle')}
    <path d="M${mobile ? 560 : 530} ${mobile ? 435 : 389} h48 v${mobile ? 81 : 68} h-48 l18 -${mobile ? 41 : 34}Z" fill="#fff" stroke="#c9cbd7" stroke-width="2"/>
    <path d="M${mobile ? 572 : 544} ${mobile ? 459 : 409} h25 m-25 13 h25 m-25 13 h25" stroke="#202020" stroke-width="3"/>
    ${text(spec.tag, mobile ? 1040 : 1730, mobile ? 572 : 477, mobile ? 32 : 36, '#fff', 700, 'middle')}
  `, W, H);
  layers.push({ input: overlay, left: 0, top: 0 });
  const filename = `festival-${spec.name}-2026-11-v2${mobile ? '-mobile' : ''}.webp`;
  await sharp({ create: { width: W, height: H, channels: 4, background: '#fff' } })
    .composite(layers).webp({ quality: 90 }).toFile(path.join(out, filename));
  console.log(path.join(out, filename));
}

(async () => {
  for (const spec of specs) {
    await render(spec, false);
    await render(spec, true);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
