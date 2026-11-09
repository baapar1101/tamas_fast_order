import 'dotenv/config';
import fs from 'node:fs';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
try {
  const rows = await sql`SELECT id, key, value, updated_at FROM settings WHERE key IN ('PAYMENT_TERMS_CONFIG', 'campaign_mode') AND deleted_at IS NULL`;
  fs.writeFileSync(process.argv[2], JSON.stringify(rows, null, 2));
  console.log(JSON.stringify({ count: rows.length, updatedAt: rows[0]?.updated_at }));
} finally { await sql.end(); }
