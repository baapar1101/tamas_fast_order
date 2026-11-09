import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const manifestPath = process.argv[2];
const apply = process.argv.includes('--apply');
if (!manifestPath) throw new Error('Usage: node scripts/apply-november-campaign-incremental.mjs <manifest.json> [--apply]');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.singles.length !== 330 || manifest.baskets.length !== 8) throw new Error('Unexpected campaign manifest');
const pendingSingles = manifest.singles.filter((item) => !item.price);
const pendingBaskets = manifest.baskets.filter((item) => !item.price);
const normalizeSku = (value) => String(value ?? '').replace(/^0+/, '');
const db = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });

function plan(rows) {
  const active = rows.filter((row) => row.status === 'active' && row.deleted_at === null);
  const bySku = new Map();
  for (const row of active) for (const code of [row.sku, row.product_id]) {
    if (code) bySku.set(normalizeSku(code), row);
  }
  const singles = pendingSingles.flatMap((item) => {
    const row = bySku.get(normalizeSku(item.sku));
    if (!row || row.promotion || Number(row.price) <= 0) return [];
    const imageUrl = row.image_url || item.imageUrl;
    const imageFile = path.join(process.cwd(), 'storage', imageUrl.replace(/^\/uploads\//, ''));
    if (!row.image_url && (!fs.existsSync(imageFile) || fs.statSync(imageFile).size < 2500)) return [];
    return [{ id: row.id, sku: item.sku, stock: item.stock, price: Number(row.price), imageUrl }];
  });
  const baskets = pendingBaskets.flatMap((basket) => {
    if (bySku.has(normalizeSku(basket.sku))) return [];
    let price = 0;
    for (const line of basket.lines) {
      const component = bySku.get(normalizeSku(line.sku));
      if (!component || Number(component.price) <= 0) return [];
      price += Number(component.price) * line.qty;
    }
    const imageFile = path.join(process.cwd(), 'storage', basket.imageUrl.replace(/^\/uploads\//, ''));
    if (!fs.existsSync(imageFile) || fs.statSync(imageFile).size < 2500) throw new Error(`Basket image missing: ${basket.sku}`);
    return [{ ...basket, price }];
  });
  const remainingSingles = pendingSingles.filter((item) => !bySku.get(normalizeSku(item.sku))?.promotion && !singles.some((row) => row.sku === item.sku)).length;
  const remainingBaskets = pendingBaskets.filter((item) => !bySku.get(normalizeSku(item.sku))?.promotion && !baskets.some((row) => row.sku === item.sku)).length;
  return { singles, baskets, remainingSingles, remainingBaskets };
}

try {
  if (!apply) {
    const rows = await db`SELECT id, product_id, sku, price, stock, status, promotion, image_url, deleted_at FROM products`;
    const p = plan(rows);
    console.log(JSON.stringify({ mode: 'dry-run', singles: p.singles, baskets: p.baskets.map(({ sku, title, price, stock }) => ({ sku, title, price, stock })), remainingSingles: p.remainingSingles, remainingBaskets: p.remainingBaskets }));
  } else {
    const result = await db.begin(async (tx) => {
      const rows = await tx`SELECT id, product_id, sku, price, stock, status, promotion, image_url, deleted_at FROM products FOR UPDATE`;
      const p = plan(rows);
      if (p.singles.length === 0 && p.baskets.length === 0) return { addedSingles: [], addedBaskets: [], remainingSingles: p.remainingSingles, remainingBaskets: p.remainingBaskets };
      const backupFile = path.join(path.dirname(manifestPath), `november-campaign-incremental-before-${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(await tx`SELECT * FROM products WHERE deleted_at IS NULL ORDER BY id`));
      // Keep any newly added non-campaign product unavailable during the festival.
      await tx`UPDATE products SET stock=0, kerman_stock=0, tehran_stock=0, updated_at=NOW()
               WHERE deleted_at IS NULL AND status='active' AND promotion=false AND (stock>0 OR kerman_stock>0 OR tehran_stock>0)`;
      for (const item of p.singles) {
        await tx`UPDATE products SET stock=${item.stock}, kerman_stock=0, tehran_stock=0, image_url=${item.imageUrl}, promotion=true, updated_at=NOW()
                 WHERE id=${item.id}`;
      }
      for (const basket of p.baskets) {
        const search = `${basket.title} ${basket.sku} جشنواره سبد`.toLowerCase();
        await tx`INSERT INTO products (product_id, sku, title, category_id, price, stock, kerman_stock, tehran_stock,
                   promotion, status, type, image_url, description, search_text)
                 VALUES (${basket.sku}, ${basket.sku}, ${basket.title}, 3, ${basket.price}, ${basket.stock}, 0, 0,
                   true, 'active', 'physical', ${basket.imageUrl}, ${basket.description}, ${search})`;
      }
      const [check] = await tx`SELECT COUNT(*)::int AS n FROM products WHERE deleted_at IS NULL AND status='active'
                  AND promotion=false AND (stock>0 OR kerman_stock>0 OR tehran_stock>0)`;
      if (check.n !== 0) throw new Error(`Non-campaign stocked products: ${check.n}`);
      return { backupFile, addedSingles: p.singles, addedBaskets: p.baskets.map(({ sku, title, price, stock }) => ({ sku, title, price, stock })), remainingSingles: p.remainingSingles, remainingBaskets: p.remainingBaskets };
    });
    console.log(JSON.stringify({ mode: 'applied', ...result }));
  }
} finally {
  await db.end();
}
