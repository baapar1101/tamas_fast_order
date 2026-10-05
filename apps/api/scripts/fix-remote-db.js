import 'dotenv/config';
import postgres from 'postgres';
import fs from 'fs';

async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    const migrations = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC`;
    console.log('Current migrations in DB:', migrations);
    
    // Read the 0006 migration
    const migrationSql = fs.readFileSync('drizzle/0006_broad_skin.sql', 'utf-8');
    
    // Run it
    console.log('Running 0006 migration manually...');
    await sql.unsafe(migrationSql);
    console.log('0006 executed successfully!');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
