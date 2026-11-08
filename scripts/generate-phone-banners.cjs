const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'references', 'banner', 'new');
const fontBold = fs.readFileSync(path.join(root, 'apps', 'web', 'public', 'fonts', 'Vazirmatn-Bold.ttf')).toString('base64');
const fontRegular = fs.readFileSync(path.join(root, 'apps', 'web', 'public', 'fonts', 'Vazirmatn-Regular.ttf')).toString('base64');
const W = 2859;
const H = 1422;

const banners = [
  {
    file: 'samsung', brandFa: 'سامسونگ', brandEn: 'Samsung Galaxy',
    models: ['A08  •  A18  •  A27', 'A57  •  S26 Ultra'],
  },
  {
    file: 'xiaomi', brandFa: 'شیائومی', brandEn: 'Xiaomi · Redmi',
    models: ['Redmi A7  •  Redmi A7 Pro', 'Redmi 17  •  Note 17', 'Note 17 Pro  •  X8 Pro'],
  },
  {
    file: 'iphone', brandFa: 'آیفون', brandEn: 'iPhone',
    models: ['18 Pro  •  18 Pro Max', 'Dou  •  17 Pro Max', '17'],
  },
];

function esc(s) { return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function text(s, y, size, weight = 'bold', color = '#151515', rtl = false) {
  return `<text x="490" y="${y}" text-anchor="middle" ${rtl ? 'direction="rtl"' : ''} font-family="Vazirmatn" font-weight="${weight}" font-size="${size}" fill="${color}">${esc(s)}</text>`;
}
function overlaySvg(b) {
  const start = b.models.length === 2 ? 746 : 710;
  const gap = b.models.length === 2 ? 94 : 88;
  const modelText = b.models.map((line, i) => text(line, start + i * gap, 55, 'bold')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <style>
      @font-face { font-family: Vazirmatn; src: url(data:font/ttf;base64,${fontBold}) format('truetype'); font-weight: bold; }
      @font-face { font-family: Vazirmatn; src: url(data:font/ttf;base64,${fontRegular}) format('truetype'); font-weight: normal; }
    </style>
    <rect x="0" y="0" width="1000" height="1422" fill="#ffffff" opacity="0.16"/>
    <rect x="130" y="225" width="14" height="185" rx="7" fill="#f46226"/>
    ${text('سری گوشی‌های', 278, 76, 'bold', '#1b1b1b', true)}
    ${text(b.brandFa, 412, 126, 'bold', '#141414', true)}
    ${text(b.brandEn, 510, 73, 'bold')}
    <line x1="270" y1="565" x2="710" y2="565" stroke="#0a849b" stroke-width="8" stroke-linecap="round"/>
    ${text('مدل‌ها', 654, 54, 'normal', '#f46226', true)}
    ${modelText}
    <rect x="210" y="1050" width="560" height="122" rx="18" fill="#f46226"/>
    <rect x="225" y="1065" width="530" height="92" rx="12" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.9"/>
    ${text('مشاهده مدل‌ها', 1133, 61, 'bold', '#ffffff', true)}
  </svg>`;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const b of banners) {
    const source = path.join(outDir, `${b.file}-art.png`);
    if (!fs.existsSync(source)) throw new Error(`Missing source art: ${source}`);
    const overlay = overlaySvg(b);
    fs.writeFileSync(path.join(outDir, `${b.file}-overlay.svg`), overlay);
    const base = await sharp(source).resize(W, H, { fit: 'cover', position: 'north' }).png().toBuffer();
    await sharp(base)
      .composite([{ input: Buffer.from(overlay) }])
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(path.join(outDir, `${b.file}-banner.jpg`));
    console.log(`${b.file}-banner.jpg`);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
