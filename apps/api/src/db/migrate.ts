import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { closeDb, db, sql } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../../drizzle');

async function main(): Promise<void> {
  // pg_trgm powers the product search index; it ships with Postgres contrib.
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await migrate(db, { migrationsFolder });
  console.log('✅ migrations applied');
  await closeDb();
}

main().catch(async (err) => {
  console.error('❌ migration failed:', err);
  await closeDb().catch(() => {});
  process.exit(1);
});
