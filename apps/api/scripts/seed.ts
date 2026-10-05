/** Minimal seed so a fresh clone has something to look at. */
import { sql } from "drizzle-orm";
import { closeDb, db } from "../src/db/client.js";
import { brands, categories, products, settings } from "../src/db/schema.js";
import { buildSearchText } from "../src/services/catalog.js";

async function main(): Promise<void> {
  const [apple] = await db
    .insert(brands)
    .values({ name: "apple", faName: "اپل", sortOrder: 1 })
    .onConflictDoUpdate({ target: brands.name, set: { faName: "اپل" } })
    .returning();

  const [phones] = await db
    .insert(categories)
    .values({ name: "mobile", faName: "موبایل", sortOrder: 1 })
    .onConflictDoUpdate({ target: categories.name, set: { faName: "موبایل" } })
    .returning();

  const demo = [
    {
      productId: "demo-1",
      title: "Apple iPhone 17 Pro Max 512/12GB ZA/A",
      model: "iPhone 17 Pro Max",
      color: "نارنجی",
      colorEn: "Cosmic Orange",
      colorCode: "#C25E27",
      price: 450_000_000,
      oldPrice: 455_000_000,
      discount: 1,
      kermanStock: 3,
      tehranStock: 2,
      warranty: "۱۸ ماه گارانتی شرکتی",
      sellType: "نقدی, اعتباری",
      promotion: true,
    },
    {
      productId: "demo-2",
      title: "Apple iPhone 17 Pro Max 512/12GB ZA/A",
      model: "iPhone 17 Pro Max",
      color: "آبی",
      colorEn: "Deep Blue",
      colorCode: "#1F3A93",
      price: 452_000_000,
      kermanStock: 1,
      tehranStock: 0,
      warranty: "۱۸ ماه گارانتی شرکتی",
      sellType: "نقدی",
      promotion: false,
    },
  ];

  const productsData = demo.map((p) => ({
    ...p,
    categoryId: phones?.id ?? null,
    brandId: apple?.id ?? null,
    stock: 0,
    searchText: buildSearchText([
      p.title,
      p.model,
      "apple اپل",
      p.color,
      p.colorEn,
      p.productId,
    ]),
  }));

  if (productsData.length > 0) {
    await db
      .insert(products)
      .values(productsData)
      .onConflictDoUpdate({
        target: products.productId,
        set: {
          title: sql`excluded.title`,
          model: sql`excluded.model`,
          color: sql`excluded.color`,
          colorEn: sql`excluded.color_en`,
          colorCode: sql`excluded.color_code`,
          price: sql`excluded.price`,
          oldPrice: sql`excluded.old_price`,
          discount: sql`excluded.discount`,
          kermanStock: sql`excluded.kerman_stock`,
          tehranStock: sql`excluded.tehran_stock`,
          warranty: sql`excluded.warranty`,
          sellType: sql`excluded.sell_type`,
          promotion: sql`excluded.promotion`,
          categoryId: sql`excluded.category_id`,
          brandId: sql`excluded.brand_id`,
          stock: sql`excluded.stock`,
          searchText: sql`excluded.search_text`,
          updatedAt: new Date(),
        },
      });
  }

  const settingsData = Object.entries({
    store_name: "تماس مارکت",
    store_tagline: "مرجع تخصصی فروش عمده لوازم جانبی موبایل",
    support_phone: "",
  }).map(([key, value]) => ({ key, value }));

  await db
    .insert(settings)
    .values(settingsData)
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: sql`excluded.value` },
    });

  console.log("✅ seeded");
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => {});
  process.exit(1);
});
