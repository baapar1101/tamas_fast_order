const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const cache = path.join(root, '.private', 'november-product-image-cache');
const output = path.join(root, 'apps', 'web', 'public', 'assets', 'products', '2026-11');
fs.mkdirSync(output, { recursive: true });

// Sources were checked against the exact model/color before use. The three
// illustrative variants are documented so storefront copy can disclose them.
const images = [
  ['02040100054', 'yau46.raw', false],
  ['10010100006', 'vc12.raw', false],
  ['02030100514', 'ca176white-reconstructed.raw', true],
  ['02030500094', 'mh103.raw', false],
  ['02020300103', '344.img', false],
  ['02030100445', 'lx28white.raw', true],
  ['02040100031', 'dh12.raw', false],
  ['08010100013', 'bg12.raw', false],
  ['02030100394', 'superfast.raw', true],
  ['02030100392', 'iphone13.raw', false],
  ['02030600007', 'bq33.raw', false],
  ['01020100133', '437.img', false],
  ['02030500083', 'xiaomiwhite.raw', true],
  ['02020400061', 'ms3628.raw', false],
  ['02020400049', 'dr16.raw', false],
];

(async () => {
  for (const [sku, source, illustrative] of images) {
    const input = path.join(cache, source);
    if (!fs.existsSync(input)) throw new Error(`Missing image source for ${sku}: ${input}`);
    const file = path.join(output, `${sku}.webp`);
    let pipeline = sharp(input).rotate();
    await pipeline.resize(800, 800, { fit: 'contain', background: '#fff', withoutEnlargement: false }).webp({ quality: 88 }).toFile(file);
    const info = await sharp(file).metadata();
    if (info.width !== 800 || info.height !== 800) throw new Error(`Bad image dimensions for ${sku}`);
    console.log(`${sku}: ${fs.statSync(file).size} bytes${illustrative ? ' (illustrative)' : ''}`);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
