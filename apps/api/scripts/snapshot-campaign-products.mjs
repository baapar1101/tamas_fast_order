import 'dotenv/config';
import fs from 'node:fs';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
try {
  const rows = await sql`SELECT id, product_id, sku, title, price, stock, kerman_stock, tehran_stock, status, promotion, image_url, category_id, type, gallery, bundle_items, deleted_at FROM products ORDER BY id`;
  fs.writeFileSync(process.argv[2], JSON.stringify(rows));
  console.log(rows.length);
} finally {
  await sql.end();
}
