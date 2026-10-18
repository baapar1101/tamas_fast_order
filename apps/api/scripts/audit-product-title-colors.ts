import { isNull } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { products } from '../src/db/schema.js';

try {
  const rows = await db.select({
    productId: products.productId,
    title: products.title,
    model: products.model,
    color: products.color,
    colorEn: products.colorEn,
    colorCode: products.colorCode,
  }).from(products).where(isNull(products.deletedAt));

  const colors = new Map<string, number>();
  const matches = [];
  const missing = [];
  for (const row of rows) {
    if (row.color) colors.set(row.color, (colors.get(row.color) ?? 0) + 1);
    else missing.push(row);
    const token = row.color?.trim();
    if (token && row.title.toLocaleLowerCase().includes(token.toLocaleLowerCase())) matches.push(row);
  }
  console.log(JSON.stringify({
    total: rows.length,
    rows,
    colors: [...colors].sort((a, b) => b[1] - a[1]),
    titleContainsOwnColorCount: matches.length,
    titleContainsOwnColor: matches,
    missingColorCount: missing.length,
    missingColorSample: missing.slice(0, 60),
  }, null, 2));
} finally {
  await closeDb();
}
