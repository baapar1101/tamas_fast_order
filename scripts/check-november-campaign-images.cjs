const fs = require('node:fs');
const rows = JSON.parse(fs.readFileSync('.private/november-campaign-check2-products.json', 'utf8'));
const images = [...new Set(rows.filter((r) => r.status === 'active' && r.promotion && r.stock > 0).map((r) => r.image_url).filter(Boolean))];
const results = [];
let next = 0;
async function worker() {
  while (next < images.length) {
    const image = images[next++];
    const url = new URL(image, 'https://tamasmarket.com').href;
    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(12000) });
      results.push({ image, status: response.status, contentType: response.headers.get('content-type') });
    } catch (error) {
      results.push({ image, error: String(error) });
    }
  }
}
Promise.all(Array.from({ length: 12 }, worker)).then(() => {
  const bad = results.filter((item) => item.status !== 200 || !item.contentType?.startsWith('image/'));
  console.log(JSON.stringify({ total: images.length, good: images.length - bad.length, bad }, null, 2));
  if (bad.length) process.exitCode = 1;
});
