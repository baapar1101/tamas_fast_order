import fs from 'fs';
import crypto from 'crypto';
import postgres from 'postgres';
import path from 'path';
import 'dotenv/config'; // will load .env if available

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL is not set in environment or .env file');
  process.exit(1);
}

console.log('Connecting to database...');
const sql = postgres(dbUrl);

async function run() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )`;

    const journalPath = path.resolve(process.cwd(), './drizzle/meta/_journal.json');
    if (!fs.existsSync(journalPath)) {
       console.error('❌ Could not find drizzle/meta/_journal.json');
       process.exit(1);
    }
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    let inserted = 0;

    for (const entry of journal.entries) {
      const filePath = path.resolve(process.cwd(), `./drizzle/${entry.tag}.sql`);
      if (!fs.existsSync(filePath)) continue;
      
      const file = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('sha256').update(file).digest('hex');
      
      const [exists] = await sql`SELECT 1 FROM "__drizzle_migrations" WHERE hash = ${hash}`;
      if (!exists) {
        await sql`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${Date.now()})`;
        console.log(`✅ Inserted migration hash for: ${entry.tag}`);
        inserted++;
      } else {
        console.log(`⏭️  Skipped ${entry.tag}, already exists`);
      }
    }
    console.log(`🎉 Done! Inserted ${inserted} missing migration hashes.`);
  } catch (error) {
    console.error('❌ Error fixing migrations:', error);
  } finally {
    process.exit(0);
  }
}

run();
