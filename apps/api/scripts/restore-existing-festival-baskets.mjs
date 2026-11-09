import 'dotenv/config';
import postgres from 'postgres';

const db = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
try {
  const result = await db.begin(async (tx) => {
    const [basket] = await tx`SELECT id, product_id, title, stock, price, status, type, image_url, bundle_items
      FROM products WHERE product_id='09190015' AND deleted_at IS NULL FOR UPDATE`;
    if (!basket || basket.status !== 'active' || basket.stock !== 0 || Number(basket.price) !== 97296000 || !basket.image_url) {
      throw new Error('Existing Oxygen speaker basket changed; review before restoring');
    }
    if (Array.isArray(basket.bundle_items) && basket.bundle_items.length > 0) {
      throw new Error('Existing bundle gained components; do not convert automatically');
    }
    // The pre-campaign basket had two sellable units. Its old bundle record has
    // no components, so physical stock is required for orders to decrement it.
    await tx`UPDATE products SET stock=2, kerman_stock=0, tehran_stock=0,
      promotion=true, type='physical', updated_at=NOW() WHERE id=${basket.id}`;
    return { id: basket.id, productId: basket.product_id, stock: 2 };
  });
  console.log(JSON.stringify(result));
} finally {
  await db.end();
}
