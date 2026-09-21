import postgres from 'postgres';
const sql = postgres('postgres://tamas:Parisa70011007@127.0.0.1:5432/tamas');
async function run() {
  try {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'settings'`;
    console.log("Columns:", cols.map(c => c.column_name).join(', '));
  } finally {
    await sql.end();
  }
}
run();
