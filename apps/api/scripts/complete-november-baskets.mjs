import 'dotenv/config';
import fs from 'node:fs';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
const enhancements = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const apply = process.argv.includes('--apply');
const gadgetOnly = process.argv.includes('--gadget-only');
const activeSkus = new Set(gadgetOnly ? ['09999990007'] : ['09999990002', '09999990003', '09999990004', '09999990005', '09999990006', '09999990008']);

try {
  const selected = enhancements.filter((item) => activeSkus.has(item.sku));
  if (selected.length !== activeSkus.size) throw new Error(`Expected ${activeSkus.size} active baskets`);
  const rows = await sql`SELECT id, product_id, sku, title, search_text, price, stock, promotion, status, image_url, gallery, bundle_items, description FROM products WHERE sku IN ${sql([...activeSkus])} AND deleted_at IS NULL`;
  if (rows.length !== activeSkus.size) throw new Error(`Expected ${activeSkus.size} existing rows, got ${rows.length}`);
  for (const item of selected) {
    const row = rows.find((product) => product.sku === item.sku);
    if (!row || row.status !== 'active' || !row.promotion || row.price <= 0 || row.stock <= 0) throw new Error(`Basket not live: ${item.sku}`);
    if (item.missingImages.length || item.bundleItems.length < (gadgetOnly ? 26 : 50) || item.gallery.length < 10) throw new Error(`Incomplete basket: ${item.sku}`);
  }
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const titleOf = (item) => {
    const units = item.bundleItems.reduce((total, line) => total + line.qty, 0);
    const count = item.bundleItems.length;
    return item.sku === '09999990008'
      ? `سبد لوازم جانبی اکسیژن — ${fa(units)} عدد در ${fa(count)} مدل`
      : item.sku === '09999990007'
        ? `سبد گجت یسیدو — ${fa(units)} عدد در ${fa(count)} مدل`
        : `سبد لوازم جانبی یسیدو شماره ${fa(Number(item.sku.slice(-1)) - 1)} — ${fa(units)} عدد در ${fa(count)} مدل`;
  };
  if (apply) {
    const backup = `scripts/november-baskets-before-${Date.now()}.json`;
    fs.writeFileSync(backup, JSON.stringify(rows, null, 2));
    await sql.begin(async (tx) => {
      for (const item of selected) {
        const title = titleOf(item);
        const searchText = `${title} ${item.sku} ${item.sku === '09999990008' ? 'oxygen اکسیژن' : 'yesido یسیدو'}`.toLowerCase();
        await tx`UPDATE products SET title=${title}, search_text=${searchText}, image_url=${item.imageUrl}, gallery=${JSON.stringify(item.gallery)}::jsonb, bundle_items=${JSON.stringify(item.bundleItems)}::jsonb, description=${item.description}, updated_at=NOW() WHERE sku=${item.sku} AND deleted_at IS NULL`;
      }
    });
    console.log(JSON.stringify({ mode: 'applied', backup, baskets: selected.map((item) => ({ sku: item.sku, items: item.bundleItems.length, photos: item.gallery.length + 1 })) }));
  } else {
    console.log(JSON.stringify({ mode: 'dry-run', baskets: selected.map((item) => ({ sku: item.sku, items: item.bundleItems.length, photos: item.gallery.length + 1 })) }));
  }
} finally {
  await sql.end();
}
