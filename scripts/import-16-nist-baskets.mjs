import 'dotenv/config';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const manifestUrl = new URL('../references/campaigns/16-nist-baskets.json', import.meta.url);
const baskets = JSON.parse(await readFile(manifestUrl, 'utf8'));
const skus = new Set();

for (const basket of baskets) {
  if (!/^0[0-9]{10}$/.test(basket.sku) || skus.has(basket.sku)) {
    throw new Error(`Invalid or duplicate basket SKU: ${basket.sku}`);
  }
  skus.add(basket.sku);
  if (!basket.title || !Number.isSafeInteger(basket.totalPriceToman) || basket.totalPriceToman <= 0) {
    throw new Error(`Invalid title or total price for ${basket.sku}`);
  }
  if (basket.stock !== 5 || !Array.isArray(basket.items) || basket.items.length === 0) {
    throw new Error(`Invalid stock or items for ${basket.sku}`);
  }
  if (basket.items.some((item) => !item.name || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    throw new Error(`Invalid item name or quantity for ${basket.sku}`);
  }
  if (basket.items.reduce((total, item) => total + item.quantity, 0) !== basket.totalItems) {
    throw new Error(`Item quantity total does not match source sheet for ${basket.sku}`);
  }
  if (basket.imageUrl !== `/assets/baskets/${basket.sku}.webp`) {
    throw new Error(`Unexpected image path for ${basket.sku}`);
  }
  await access(fileURLToPath(new URL(`../apps/web/public${basket.imageUrl}`, import.meta.url)));
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
const db = postgres(process.env.DATABASE_URL, { max: 1 });
const apply = process.argv.includes('--apply');

try {
  const [category] = await db`
    SELECT id, name, fa_name FROM categories
    WHERE name = 'Bondle' AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!category) throw new Error('Basket category Bondle does not exist');

  const existing = await db`
    SELECT product_id, sku FROM products
    WHERE product_id = ANY(${[...skus]}::text[]) OR sku = ANY(${[...skus]}::text[])
  `;
  if (existing.length) {
    throw new Error(`Basket SKUs already exist; refusing to overwrite: ${existing.map((row) => row.sku ?? row.product_id).join(', ')}`);
  }

  if (!apply) {
    for (const basket of baskets) {
      console.log(`DRY RUN ${basket.sku}: ${basket.title}, ${basket.totalPriceToman} toman, ${basket.totalItems} items, stock ${basket.stock}`);
    }
    console.log('No products were changed. Run again with --apply to create them.');
  } else {
    await db.begin(async (tx) => {
      for (const basket of baskets) {
        const count = new Intl.NumberFormat('fa-IR');
        const description = [
          `اقلام سبد (مجموع ${count.format(basket.totalItems)} عدد):`,
          ...basket.items.map((item, index) =>
            `${count.format(index + 1)}. ${item.name} — ${count.format(item.quantity)} عدد`),
        ].join('\n');
        const searchText = [basket.title, basket.sku, ...basket.items.map((item) => item.name)].join(' ').toLowerCase();

        await tx`
          INSERT INTO products (
            product_id, sku, title, category_id, price,
            stock, kerman_stock, tehran_stock, promotion, status,
            description, type, image_url, search_text
          ) VALUES (
            ${basket.sku}, ${basket.sku}, ${basket.title}, ${category.id}, ${basket.totalPriceToman},
            ${basket.stock}, ${basket.stock}, 0, true, 'active',
            ${description}, 'physical', ${basket.imageUrl}, ${searchText}
          )
        `;
        await tx`
          INSERT INTO crm_sync_logs (entity, entity_key, action, status, payload)
          VALUES ('product', ${basket.sku}, 'create', 'pending', ${JSON.stringify({ source: '16-nist-basket-sheet', attempt: 0 })}::jsonb)
        `;
      }
    });
    console.log(`Created ${baskets.length} physical basket products. CRM sync jobs are queued.`);
  }
} finally {
  await db.end();
}
