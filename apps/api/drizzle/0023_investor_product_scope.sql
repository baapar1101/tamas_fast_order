ALTER TABLE "order_items" ADD COLUMN "investor_financed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "investor_financed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "products_investor_financed_idx" ON "products" USING btree ("investor_financed");--> statement-breakpoint
CREATE INDEX "order_items_investor_financed_idx" ON "order_items" USING btree ("investor_financed");--> statement-breakpoint
UPDATE "products" AS p
SET "investor_financed" = true,
    "updated_at" = now()
WHERE p."kerman_stock" > 0
  AND p."deleted_at" IS NULL
  AND p."category_id" IN (
    SELECT c."id"
    FROM "categories" AS c
    WHERE c."id" = 2
       OR lower(c."name") IN ('mobile', 'mobile phone', 'mobile phones', 'phone', 'phones')
       OR c."fa_name" IN ('گوشی', 'گوشی موبایل', 'موبایل')
  );--> statement-breakpoint
UPDATE "order_items" AS oi
SET "investor_financed" = true
WHERE EXISTS (
  SELECT 1
  FROM "products" AS p
  WHERE p."product_id" = oi."product_id"
    AND p."investor_financed" = true
);
