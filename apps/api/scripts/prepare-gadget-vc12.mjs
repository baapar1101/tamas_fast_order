import 'dotenv/config';
import fs from 'node:fs';
import postgres from 'postgres';

const sku = '10010100006';
const imageUrl = '/uploads/product/2026-11/yesido-vc12.webp';
const title = 'کمپرسور هوا برند YESIDO مدل VC12 رنگ مشکی';
const description = 'کمپرسور هوای شارژی یسیدو مدل VC12 با باتری ۷۸۰۰ میلی‌آمپرساعت، فشار تا ۱۵۰ PSI، نمایشگر دیجیتال، توقف خودکار پس از رسیدن به فشار تنظیم‌شده و چراغ اضطراری.';
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
try {
  const file = `storage/${imageUrl.replace(/^\/uploads\//, '')}`;
  if (!fs.existsSync(file) || fs.statSync(file).size < 2500) throw new Error('VC12 image not installed');
  const matches = await sql`SELECT id, product_id, sku, title, price, stock, image_url FROM products WHERE deleted_at IS NULL AND (sku IN (${sku}, ${`0${sku}`}) OR product_id IN (${sku}, ${`0${sku}`}) OR title ILIKE '%VC12%')`;
  if (matches.length) {
    if (matches.length === 1 && matches[0].sku === sku && Number(matches[0].price) === 0) {
      await sql`UPDATE products SET description=${description}, updated_at=NOW() WHERE id=${matches[0].id} AND price=0`;
    }
    console.log(JSON.stringify({ alreadyExists: matches }));
  }
  else {
    const [row] = await sql`INSERT INTO products (product_id, sku, title, model, category_id, brand_id, price, stock, kerman_stock, tehran_stock, status, promotion, type, image_url, search_text, description)
      VALUES (${sku}, ${sku}, ${title}, 'VC12', 6, 13, 0, 0, 0, 0, 'active', false, 'physical', ${imageUrl}, ${`${title} ${sku} yesido vc12`.toLowerCase()}, ${description}) RETURNING id, product_id, sku, price, stock, image_url`;
    console.log(JSON.stringify({ created: row }));
  }
} finally { await sql.end(); }
