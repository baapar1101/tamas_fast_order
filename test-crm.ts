import { db } from './apps/api/src/db/client.js';
import { settings } from './apps/api/src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'crm')).limit(1);
  if (!row) return console.log('no crm config');
  const c = row.value as any;
  const url = `${c.apiBase.replace(/\/$/, '')}/api/v1/crm/businesses/${c.businessId}/chat/conversations`;
  console.log("Fetching:", url);
  const res = await fetch(url, { headers: { 'Authorization': `ApiKey ${c.apiKey}` } });
  const data = await res.json();
  console.log(JSON.stringify(data.items?.[0] || data.data?.[0] || data[0] || data, null, 2));
  process.exit(0);
}
main();
