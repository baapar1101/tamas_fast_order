import postgres from 'postgres';
const sql = postgres('postgres://tamas:Parisa70011007@127.0.0.1:5432/tamas');
async function run() {
  try {
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_product_id varchar(80)`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS other_stocks jsonb DEFAULT '{}'::jsonb NOT NULL`;
    await sql`CREATE INDEX IF NOT EXISTS products_parent_idx ON products USING btree (parent_product_id)`;
    console.log('Successfully added columns!');
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}
run();
