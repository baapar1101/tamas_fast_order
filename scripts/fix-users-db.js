import postgres from 'postgres';
const sql = postgres('postgres://tamas:Parisa70011007@127.0.0.1:5432/tamas');

async function run() {
  try {
    console.log('Adding missing columns to users table...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS national_code varchar(20) DEFAULT '' NOT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date varchar(20) DEFAULT '' NOT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS father_name varchar(120) DEFAULT '' NOT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_identity boolean DEFAULT false NOT NULL`;
    
    console.log('Successfully updated the users table schema!');
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    await sql.end();
  }
}

run();
