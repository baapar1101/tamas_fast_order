import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const manifestPath = process.argv[2];
const apply = process.argv.includes('--apply');
if (!manifestPath) throw new Error('Usage: node scripts/apply-november-campaign.mjs <manifest.json> [--apply]');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.singles.length !== 330 || manifest.baskets.length !== 8 || manifest.existingBaskets.length !== 5) {
  throw new Error('Campaign manifest has unexpected product counts');
}
const pricedSingles = manifest.singles.filter((p) => Number.isSafeInteger(p.price) && p.price > 0);
const pricedBaskets = manifest.baskets.filter((p) => Number.isSafeInteger(p.price) && p.price > 0);
if (pricedSingles.length !== 315 || pricedBaskets.length !== 1 || manifest.existingBaskets.some((p) => !Number.isSafeInteger(p.price) || p.price <= 0)) {
  throw new Error('Campaign has missing or invalid prices; no changes made');
}
const selectedSkus = [...pricedSingles, ...pricedBaskets, ...manifest.existingBaskets].map((p) => p.sku);
if (new Set(selectedSkus).size !== selectedSkus.length) throw new Error('Campaign SKU collision');

for (const item of [...pricedSingles.filter((p) => !p.existingId), ...pricedBaskets]) {
  const file = path.join(process.cwd(), 'storage', item.imageUrl.replace(/^\/uploads\//, ''));
  if (!fs.existsSync(file) || fs.statSync(file).size < 2500) throw new Error(`Missing image: ${file}`);
}
const festivalSlides = [
  { title: 'جشنواره این ماه | کالاهای تک‌قلم', image: '/uploads/slide/2026-11/festival-singles-2026-11.webp', mobile: '/uploads/slide/2026-11/festival-singles-2026-11-mobile.webp', link: '/?promo=1', sort: 100 },
  { title: 'جشنواره این ماه | سبدهای ویژه', image: '/uploads/slide/2026-11/festival-baskets-2026-11.webp', mobile: '/uploads/slide/2026-11/festival-baskets-2026-11-mobile.webp', link: '/?basket=1&promo=1', sort: 90 },
];
for (const slide of festivalSlides) for (const url of [slide.image, slide.mobile]) {
  const file = path.join(process.cwd(), 'storage', url.replace(/^\/uploads\//, ''));
  if (!fs.existsSync(file) || fs.statSync(file).size < 2500) throw new Error(`Missing slide image: ${file}`);
}

const db = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 5, connect_timeout: 15 });
const preflight = async (sql) => {
  const rows = await sql`SELECT id, product_id, sku, price, stock, kerman_stock, tehran_stock, status, deleted_at, image_url FROM products WHERE deleted_at IS NULL`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const byPublicId = new Map(rows.map((r) => [r.product_id, r]));
  for (const item of pricedSingles) {
    if (item.existingId) {
      const row = byId.get(item.existingId);
      const normalizedSku = item.sku.replace(/^0+/, '');
      if (!row || row.status !== 'active' || (![row.sku, row.product_id].some((code) => code?.replace(/^0+/, '') === normalizedSku))) throw new Error(`Existing Tak kala product changed: ${item.sku}`);
      if (Number(row.price) !== item.price) throw new Error(`Current site price changed: ${item.sku}`);
      if (!row.image_url) throw new Error(`Existing Tak kala image missing: ${item.sku}`);
    } else if (byPublicId.has(item.sku) || rows.some((r) => r.sku === item.sku)) {
      throw new Error(`New Tak kala SKU now exists: ${item.sku}`);
    }
  }
  for (const basket of pricedBaskets) {
    if (byPublicId.has(basket.sku) || rows.some((r) => r.sku === basket.sku)) throw new Error(`Basket SKU now exists: ${basket.sku}`);
    for (const line of basket.lines ?? []) {
      if (!line.siteId) continue;
      const row = byId.get(line.siteId);
      if (!row || Number(row.price) !== line.unitPrice) throw new Error(`Current component price changed: ${basket.sku}/${line.sku}`);
    }
  }
  for (const basket of manifest.existingBaskets) {
    const row = byPublicId.get(basket.sku);
    if (!row || row.status !== 'active' || !row.image_url) throw new Error(`Existing basket changed: ${basket.sku}`);
    if (row.stock !== basket.stock && basket.sku !== '02030200151') throw new Error(`Cover basket stock changed: ${basket.sku}`);
  }
  const existingSlides = await sql`SELECT id FROM slides WHERE image_url LIKE '%/festival-%-2026-11.webp'`;
  if (existingSlides.length) throw new Error('Festival slides already exist');
  return { rows, byId, byPublicId };
};

try {
  if (!apply) {
    const state = await preflight(db);
    console.log(JSON.stringify({ mode: 'dry-run', singles: pricedSingles.length, newSingles: pricedSingles.filter((p) => !p.existingId).length, newBaskets: pricedBaskets.length, existingBaskets: manifest.existingBaskets.length, activeStockedBefore: state.rows.filter((r) => r.status === 'active' && (r.stock > 0 || r.kerman_stock > 0 || r.tehran_stock > 0)).length }));
    process.exitCode = 0;
  } else {
    const result = await db.begin(async (tx) => {
      // Lock the entire catalog before the preflight and stock switch. Shoppers
      // see either the old catalog or the complete festival, never a half state.
      await tx`SELECT id FROM products WHERE deleted_at IS NULL FOR UPDATE`;
      await preflight(tx);
      const backup = await tx`SELECT * FROM products WHERE deleted_at IS NULL ORDER BY id`;
      const backupFile = path.join(path.dirname(manifestPath), `november-campaign-before-${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(backup));
      const slidesBackup = await tx`SELECT * FROM slides ORDER BY id`;
      fs.writeFileSync(backupFile.replace('campaign-before', 'slides-before'), JSON.stringify(slidesBackup));
      await tx`UPDATE products SET stock=0, kerman_stock=0, tehran_stock=0, promotion=false, updated_at=NOW() WHERE deleted_at IS NULL AND status='active'`;
      for (const item of pricedSingles) {
        if (item.existingId) {
          await tx`UPDATE products SET stock=${item.stock}, kerman_stock=0, tehran_stock=0, promotion=true, updated_at=NOW() WHERE id=${item.existingId}`;
        } else {
          const note = item.illustrative ? 'تصویر کالا نمونه‌ای برای نمایش شکل و رنگ محصول است.' : null;
          const search = `${item.title} ${item.sku} ${item.color}`.toLowerCase();
          await tx`INSERT INTO products (product_id, sku, title, category_id, brand_id, color, price, stock, kerman_stock, tehran_stock, promotion, status, type, image_url, description, search_text)
                   VALUES (${item.sku}, ${item.sku}, ${item.title}, ${item.categoryId}, ${item.brandId}, ${item.color}, ${item.price}, ${item.stock}, 0, 0, true, 'active', 'physical', ${item.imageUrl}, ${note}, ${search})`;
        }
      }
      for (const basket of manifest.existingBaskets) {
        const oldPrice = basket.oldPrice ?? null;
        const discount = oldPrice ? Math.round((oldPrice - basket.price) * 100 / oldPrice) : 0;
        await tx`UPDATE products SET price=${basket.price}, old_price=${oldPrice}, discount=${discount}, stock=${basket.stock}, kerman_stock=0, tehran_stock=0,
                 description=${basket.description}, promotion=true, type='physical', bundle_items='[]'::jsonb, updated_at=NOW() WHERE product_id=${basket.sku}`;
      }
      for (const basket of pricedBaskets) {
        const oldPrice = basket.oldPrice ?? null;
        const discount = oldPrice ? Math.round((oldPrice - basket.price) * 100 / oldPrice) : 0;
        const search = `${basket.title} ${basket.sku} جشنواره سبد`.toLowerCase();
        await tx`INSERT INTO products (product_id, sku, title, category_id, price, old_price, discount, stock, kerman_stock, tehran_stock, promotion, status, type, image_url, description, search_text)
                 VALUES (${basket.sku}, ${basket.sku}, ${basket.title}, 3, ${basket.price}, ${oldPrice}, ${discount}, ${basket.stock}, 0, 0, true, 'active', 'physical', ${basket.imageUrl}, ${basket.description}, ${search})`;
      }
      const [check] = await tx`SELECT COUNT(*)::int AS selected_count FROM products WHERE deleted_at IS NULL AND status='active' AND promotion=true AND (stock>0 OR kerman_stock>0 OR tehran_stock>0)`;
      if (check.selected_count !== 321) throw new Error(`Post-apply selected count mismatch: ${check.selected_count}`);
      for (const slide of festivalSlides) {
        await tx`INSERT INTO slides (title, image_url, mobile_image_url, link_url, sort_order, is_active)
                 VALUES (${slide.title}, ${slide.image}, ${slide.mobile}, ${slide.link}, ${slide.sort}, true)`;
      }
      await tx`INSERT INTO settings (key, value) VALUES ('campaign_mode', '2026-11-partial')
               ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`;
      return { backupFile, selectedCount: check.selected_count };
    });
    console.log(JSON.stringify({ mode: 'applied', ...result }));
  }
} finally {
  await db.end();
}
