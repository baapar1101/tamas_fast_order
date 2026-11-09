import 'dotenv/config';
import postgres from 'postgres';
const db = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15 });
try {
  const result = await db.begin(async (tx) => {
    const rows = await tx`SELECT id, image_url, mobile_image_url FROM slides WHERE image_url IN
      ('/uploads/slide/2026-11/festival-singles-2026-11.webp', '/uploads/slide/2026-11/festival-baskets-2026-11.webp') FOR UPDATE`;
    if (rows.length !== 2) throw new Error(`Expected two first-version festival slides, got ${rows.length}`);
    for (const row of rows) {
      const kind = row.image_url.includes('singles') ? 'singles' : 'baskets';
      await tx`UPDATE slides SET image_url=${`/uploads/slide/2026-11/festival-${kind}-2026-11-v2.webp`},
        mobile_image_url=${`/uploads/slide/2026-11/festival-${kind}-2026-11-v2-mobile.webp`}, updated_at=NOW()
        WHERE id=${row.id}`;
    }
    return rows.map((row) => row.id);
  });
  console.log(JSON.stringify({ updatedSlideIds: result }));
} finally {
  await db.end();
}
