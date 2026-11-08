const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'references', 'banner', 'new');
const W = 2859, H = 1422;
const bold = fs.readFileSync(path.join(root, 'apps/web/public/fonts/Vazirmatn-Bold.ttf')).toString('base64');
const regular = fs.readFileSync(path.join(root, 'apps/web/public/fonts/Vazirmatn-Regular.ttf')).toString('base64');

const designs = [
  { name: 'samsung', headline: 'سری گوشی‌های سامسونگ', english: 'Galaxy Series',
    models: ['A08', 'A18', 'A27', 'A57', 'S26 Ultra'], imageWidth: 1300, left: 875, top: 335,
    anchors: [[1320,510],[1470,610],[1600,720],[1770,800],[1940,530]] },
  { name: 'xiaomi', headline: 'سری گوشی‌های شیائومی', english: 'Redmi · Xiaomi',
    models: ['Redmi A7', 'Redmi A7 Pro', 'Redmi 17', 'Note 17', 'Note 17 Pro', 'X8 Pro'], imageWidth: 1300, left: 850, top: 365,
    anchors: [[1260,510],[1420,640],[1600,790],[1750,540],[1900,680],[2050,800]] },
  { name: 'iphone', headline: 'سری گوشی‌های آیفون', english: 'iPhone Series',
    models: ['iPhone 18 Pro', 'iPhone 18 Pro Max', 'Dou', 'iPhone 17 Pro Max', 'iPhone 17'], imageWidth: 910, left: 1030, top: 280,
    anchors: [[1310,520],[1480,620],[1600,750],[1770,550],[1880,810]] },
];
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function txt(s,x,y,size,weight='bold',color='#171717',rtl=false,anchor='start') {
  return `<text x="${x}" y="${y}" font-family="Vazirmatn" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" ${rtl?'direction="rtl"':''}>${esc(s)}</text>`;
}
function svgOpen(bg='#fff') { return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>`; }
const svgEnd = '</svg>';
function backgroundSvg(d) {
  return svgOpen(d.name==='iphone'?'#f7f7f9':'#fdfdfd') + `
    <path d="M490 130 L490 600 Q490 645 535 645 L780 645 L780 1140 L615 900 Q588 860 540 860 L430 860 L175 600 L405 600 L405 130 Z" fill="#ededee" opacity=".7"/>
    <path d="M1640 1422 C1800 1350 1840 1080 2060 1090 C2350 1105 2580 1145 2859 1010 L2859 1422Z" fill="#191615"/>
    <path d="M1950 1422 C2130 1240 2350 1215 2590 1270 C2720 1300 2810 1350 2859 1380 L2859 1422Z" fill="#0b8298"/>
    <path d="M2110 1422 C2295 1295 2490 1300 2680 1345 C2760 1365 2830 1390 2859 1410 L2859 1422Z" fill="#fdfdfd"/>
  ` + svgEnd;
}
function overlaySvg(d) {
  const labelYs = d.models.length===6 ? [375,485,595,705,815,925] : [420,535,650,765,880];
  let callouts = '';
  for(let i=0;i<d.models.length;i++) {
    const [ax,ay]=d.anchors[i], y=labelYs[i], elbow=2100+(i%2)*48;
    callouts += `<path d="M${ax} ${ay} L${elbow} ${ay} Q${elbow+24} ${ay} ${elbow+24} ${ay+(y>ay?24:-24)} L${elbow+24} ${y} L2194 ${y}" fill="none" stroke="#202020" stroke-width="2.5"/>
      <circle cx="${ax}" cy="${ay}" r="14" fill="#1d1d1d"/>
      <circle cx="2210" cy="${y}" r="14" fill="#fdfdfd" stroke="#202020" stroke-width="2.5"/>
      ${txt(d.models[i],2250,y+20,59,'bold')}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <style>@font-face{font-family:Vazirmatn;src:url(data:font/ttf;base64,${bold}) format('truetype');font-weight:bold}
    @font-face{font-family:Vazirmatn;src:url(data:font/ttf;base64,${regular}) format('truetype');font-weight:normal}</style>
    ${callouts}
    ${txt(d.headline,520,390,82,'bold','#161616',true,'middle')}
    ${txt('در تماس مارکت',520,535,75,'normal','#1b1b1b',true,'middle')}
    <rect x="157" y="581" width="13" height="91" rx="6" fill="#f46226"/>
    ${txt(d.english,208,660,78,'bold')}
    ${txt('مدل‌های متنوع برای انتخاب شما',520,885,56,'normal','#171717',true,'middle')}
    <path d="M200 918 C188 1010 215 1030 295 1058" fill="none" stroke="#171717" stroke-width="7" stroke-linecap="round"/>
    <path d="M275 1030 L305 1060 L268 1072" fill="none" stroke="#171717" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="310" y="1035" width="475" height="105" rx="11" fill="#f46226"/>
    <path d="M745 1035 L830 1035 Q844 1035 844 1048 L844 1127 Q844 1140 830 1140 L745 1140 L770 1087 Z" fill="#fff" stroke="#c8c9d8" stroke-width="4"/>
    ${txt('مشاهده مدل‌ها',545,1106,57,'bold','#fff',true,'middle')}
    <path d="M786 1065 H827 M786 1088 H827 M786 1111 H827" stroke="#1d1d1d" stroke-width="6"/>
    ${txt(d.name==='samsung'?'SAMSUNG':d.name==='xiaomi'?'Redmi by Xiaomi':'iPhone',2445,1230,75,'bold','#fff',false,'middle')}
  </svg>`;
}
(async()=>{
  for(const d of designs) {
    const cutout=path.join(outDir,`${d.name}-cutout.png`);
    const device=await sharp(cutout).resize({width:d.imageWidth}).png().toBuffer();
    const background=Buffer.from(backgroundSvg(d));
    const overlay=Buffer.from(overlaySvg(d));
    fs.writeFileSync(path.join(outDir,`${d.name}-overlay-v2.svg`),overlay);
    await sharp(background).composite([{input:device,left:d.left,top:d.top},{input:overlay,left:0,top:0}])
      .jpeg({quality:91,mozjpeg:true}).toFile(path.join(outDir,`${d.name}-banner-v2.jpg`));
    console.log(`${d.name}-banner-v2.jpg`);
  }
})().catch(e=>{console.error(e);process.exitCode=1});
