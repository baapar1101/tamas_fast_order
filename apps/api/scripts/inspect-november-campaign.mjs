import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
try {
  const [settings, slides, products] = await Promise.all([
    sql`SELECT key, value FROM settings WHERE key IN ('storefront_filters', 'campaign_mode', 'store_name')`,
    sql`SELECT id, title, image_url, mobile_image_url, link_url, sort_order, is_active FROM slides ORDER BY sort_order DESC, id DESC`,
    sql`SELECT product_id, sku, title, price, stock, kerman_stock, tehran_stock, status, promotion FROM products WHERE deleted_at IS NULL AND (product_id IN ('02030200151','02010104586','02010104585','02010104587','02010104588','09999990009') OR sku IN ('02030200151','02010104586','02010104585','02010104587','02010104588','09999990009')) ORDER BY product_id`,
  ]);
  console.log(JSON.stringify({ settings, slides, products }, null, 2));
} finally {
  await sql.end();
}
