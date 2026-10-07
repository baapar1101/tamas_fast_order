import { db } from './apps/api/src/db/client.js';
import { warehouses } from './apps/api/src/db/schema.js';

async function seedWarehouses() {
  const existing = await db.select().from(warehouses);
  const codes = new Set(existing.map((w) => w.code));

  if (!codes.has('tehran')) {
    await db.insert(warehouses).values({
      code: 'tehran',
      name: 'انبار تهران',
      location: 'تهران',
      isActive: true,
    });
    console.log('Seeded Tehran warehouse');
  }

  if (!codes.has('kerman')) {
    await db.insert(warehouses).values({
      code: 'kerman',
      name: 'انبار کرمان',
      location: 'کرمان',
      isActive: true,
    });
    console.log('Seeded Kerman warehouse');
  }

  process.exit(0);
}

seedWarehouses().catch(console.error);
