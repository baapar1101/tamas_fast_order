import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
try {
  const rows = await sql`SELECT id, product_id, sku, title, price, stock, status, promotion, image_url FROM products
    WHERE deleted_at IS NULL AND (sku IN ('10010100006', '09999990007') OR title ILIKE '%VC12%') ORDER BY id`;
  console.log(JSON.stringify(rows));
  const comparable = await sql`SELECT product_id, sku, title, brand_id, category_id, status, price, stock FROM products WHERE deleted_at IS NULL AND product_id LIKE '0100101%' ORDER BY id DESC LIMIT 8`;
  console.log(JSON.stringify({ comparable }));
} finally { await sql.end(); }
