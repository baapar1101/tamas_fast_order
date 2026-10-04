CREATE TABLE "product_tracking_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_db_id" integer NOT NULL,
	"site_id" integer NOT NULL,
	"url" varchar(1000) NOT NULL,
	"last_price" bigint,
	"in_stock" boolean,
	"quantity" integer DEFAULT 0 NOT NULL,
	"status_text" varchar(500),
	"last_error" varchar(1000),
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"base_url" varchar(1000),
	"price_unit" varchar(10) DEFAULT 'toman' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_tracking_links" ADD CONSTRAINT "product_tracking_links_product_db_id_products_id_fk" FOREIGN KEY ("product_db_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tracking_links" ADD CONSTRAINT "product_tracking_links_site_id_tracking_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."tracking_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_tracking_links_product_site_key" ON "product_tracking_links" USING btree ("product_db_id","site_id");--> statement-breakpoint
CREATE INDEX "product_tracking_links_product_idx" ON "product_tracking_links" USING btree ("product_db_id");--> statement-breakpoint
CREATE INDEX "product_tracking_links_site_idx" ON "product_tracking_links" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_sites_name_key" ON "tracking_sites" USING btree ("name");--> statement-breakpoint
INSERT INTO "tracking_sites" ("name", "price_unit", "is_active")
SELECT 'سایت هدف قبلی', 'toman', true
WHERE EXISTS (
	SELECT 1 FROM "products" WHERE "target_site_url" IS NOT NULL AND trim("target_site_url") <> ''
);--> statement-breakpoint
INSERT INTO "product_tracking_links" ("product_db_id", "site_id", "url")
SELECT p."id", s."id", p."target_site_url"
FROM "products" p
CROSS JOIN "tracking_sites" s
WHERE s."name" = 'سایت هدف قبلی'
	AND p."target_site_url" IS NOT NULL
	AND trim(p."target_site_url") <> ''
ON CONFLICT ("product_db_id", "site_id") DO NOTHING;
