import 'dotenv/config';
import fs from 'node:fs';
import postgres from 'postgres';

const price = 10_741_000;
const sku = '10010100006';
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
try {
  const result = await sql.begin(async (tx) => {
    const rows = await tx`SELECT * FROM products WHERE sku=${sku} AND deleted_at IS NULL FOR UPDATE`;
    if (rows.length !== 1) throw new Error(`Expected one VC12 product, found ${rows.length}`);
    const row = rows[0];
    if (row.title !== 'کمپرسور هوا برند YESIDO مدل VC12 رنگ مشکی' || row.status !== 'active' || !row.image_url) throw new Error('VC12 data changed');
    if (Number(row.price) === price) return { unchanged: true, id: row.id, price };
    if (Number(row.price) !== 0 || row.promotion || row.stock !== 0) throw new Error('VC12 price/stock changed unexpectedly');
    const backup = `scripts/vc12-before-price-${Date.now()}.json`;
    fs.writeFileSync(backup, JSON.stringify(row, null, 2));
    await tx`UPDATE products SET price=${price}, color='مشکی', updated_at=NOW() WHERE id=${row.id}`;
    return { id: row.id, sku, price, backup };
  });
  console.log(JSON.stringify(result));
} finally { await sql.end(); }
