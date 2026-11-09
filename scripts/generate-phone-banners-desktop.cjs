const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'references', 'banner', 'new');
const output = path.join(root, 'apps', 'web', 'public', 'assets', 'slides');
const W = 2000, H = 500;
const bold = fs.readFileSync(path.join(root, 'apps/web/public/fonts/Vazirmatn-Bold.ttf')).toString('base64');
const regular = fs.readFileSync(path.join(root, 'apps/web/public/fonts/Vazirmatn-Regular.ttf')).toString('base64');
const designs = [
  { name: 'samsung', headline: 'سری گوشی‌های سامسونگ', english: 'Galaxy Series', brand: 'SAMSUNG',
    models: ['A08', 'A18', 'A27', 'A57', 'S26 Ultra'], x: 630, y: 55, width: 820,
    anchors: [[760,195],[880,230],[1040,265],[1170,245],[1330,210]] },
  { name: 'xiaomi', headline: 'سری گوشی‌های شیائومی', english: 'Redmi · Xiaomi', brand: 'Redmi by Xiaomi',
    models: ['Redmi A7', 'Redmi A7 Pro', 'Redmi 17', 'Note 17', 'Note 17 Pro', 'X8 Pro'], x: 610, y: 65, width: 830,
    anchors: [[740,185],[860,225],[980,280],[1100,205],[1220,260],[1340,310]] },
  { name: 'iphone', headline: 'سری گوشی‌های آیفون', english: 'iPhone Series', brand: 'iPhone',
    models: ['iPhone 18 Pro', 'iPhone 18 Pro Max', 'Dou', 'iPhone 17 Pro Max', 'iPhone 17'], x: 790, y: 25, width: 540,
    anchors: [[845,190],[945,235],[1050,280],[1155,240],[1260,290]] },
];
const esc = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const txt = (text, x, y, size, color = '#161616', rtl = false, anchor = 'start', weight = 'bold') =>
  `<text x="${x}" y="${y}" font-family="Vazirmatn" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" ${rtl ? 'direction="rtl"' : ''}>${esc(text)}</text>`;

function background(design) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${design.name === 'iphone' ? '#fafafd' : '#fff'}"/>
    <path d="M220 35 L220 285 L360 285 L360 440 L270 365 L175 365 L80 255 L175 255 L175 35Z" fill="#f0f0f1"/>
    <path d="M1320 500 C1460 405 1600 430 1740 420 C1860 410 1920 385 2000 355 L2000 500Z" fill="#181414"/>
    <path d="M1540 500 C1660 445 1810 455 2000 490 L2000 500Z" fill="#047f98"/>
  </svg>`);
}
function overlay(design) {
  const ys = design.models.length === 6 ? [90, 152, 214, 276, 338, 400] : [105, 177, 249, 321, 393];
  let lines = '';
  for (let i = 0; i < design.models.length; i++) {
    const [ax, ay] = design.anchors[i];
    const endY = ys[i];
    const elbow = 1430 + (i % 2) * 30;
    lines += `<path d="M${ax} ${ay} L${elbow} ${ay} L${elbow} ${endY} L1510 ${endY}" stroke="#202020" stroke-width="2" fill="none"/>
      <circle cx="${ax}" cy="${ay}" r="8" fill="#202020"/>
      <circle cx="1519" cy="${endY}" r="8" fill="#fff" stroke="#202020" stroke-width="2"/>
      ${txt(design.models[i], 1545, endY + 11, 33)}`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <style>@font-face{font-family:Vazirmatn;src:url(data:font/ttf;base64,${bold}) format('truetype');font-weight:bold}
    @font-face{font-family:Vazirmatn;src:url(data:font/ttf;base64,${regular}) format('truetype');font-weight:normal}</style>
    ${lines}
    ${txt(design.headline, 330, 110, 48, '#161616', true, 'middle')}
    ${txt('در تماس مارکت', 330, 174, 43, '#161616', true, 'middle', 'normal')}
    <rect x="70" y="218" width="8" height="61" rx="4" fill="#f46226"/>
    ${txt(design.english, 95, 270, 51)}
    ${txt('مدل‌های متنوع برای انتخاب شما', 330, 345, 29, '#202020', true, 'middle', 'normal')}
    <path d="M88 354 C78 391 98 409 133 418 M125 410 L140 421 L120 428" fill="none" stroke="#171717" stroke-width="4" stroke-linecap="round"/>
    <rect x="155" y="378" width="315" height="65" rx="8" fill="#f46226"/>
    <path d="M418 378 L481 378 Q489 378 489 386 L489 435 Q489 443 481 443 L418 443 L436 410Z" fill="#fff" stroke="#c9cbd7" stroke-width="2"/>
    ${txt('مشاهده مدل‌ها', 285, 423, 33, '#fff', true, 'middle')}
    <path d="M443 397 H475 M443 410 H475 M443 423 H475" stroke="#202020" stroke-width="3"/>
    ${txt(design.brand, 1730, 472, 36, '#fff', false, 'middle')}
    ${txt('تصاویر نمایشی', 40, 483, 17, '#777', true, 'end', 'normal')}
  </svg>`);
}

(async () => {
  for (const design of designs) {
    const cutout = await sharp(path.join(source, `${design.name}-cutout.png`)).resize({ width: design.width }).png().toBuffer();
    const image = await sharp(background(design)).composite([
      { input: cutout, left: design.x, top: design.y },
      { input: overlay(design), left: 0, top: 0 },
    ]).webp({ quality: 91 }).toBuffer();
    const desktop = path.join(output, `phone-${design.name}-2026-11.webp`);
    fs.writeFileSync(desktop, image);
    await sharp(path.join(source, `${design.name}-banner-v2.jpg`)).resize(1200, 600).webp({ quality: 90 }).toFile(path.join(output, `phone-${design.name}-2026-11-mobile.webp`));
    console.log(desktop);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
