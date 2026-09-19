import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env, isProd } from '../env.js';
import * as schema from './schema.js';

/**
 * One pool for the whole process. `postgres-js` keeps prepared statements per
 * connection, which is what makes the catalogue queries cheap under load.
 */
export const sql = postgres(env.DATABASE_URL, {
  max: env.DATABASE_POOL_MAX,
  idle_timeout: 30,
  connect_timeout: 15,
  prepare: true,
  onnotice: isProd ? () => {} : undefined,
});

export const db = drizzle(sql, { schema, casing: 'snake_case' });

export type Db = typeof db;
export { schema };

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
