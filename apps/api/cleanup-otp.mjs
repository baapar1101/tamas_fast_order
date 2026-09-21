import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const envRaw = readFileSync(new URL('./.env', import.meta.url), 'utf8');
const dbUrl = (envRaw.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim();
const adminPhone = (envRaw.match(/^ADMIN_PHONES=(.+)$/m) || [])[1]?.trim();

const sql = postgres(dbUrl, { max: 1, connect_timeout: 10 });
try {
  const del = await sql`DELETE FROM otp_codes WHERE phone = ${adminPhone} RETURNING id`;
  console.log('deleted ' + del.length + ' otp rows for ' + adminPhone.slice(0, 4) + '***');
} finally {
  await sql.end({ timeout: 3 });
}
process.exit(0);