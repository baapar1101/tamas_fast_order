CREATE TABLE "attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
-- ALTER TABLE "orders" ADD COLUMN "payment_method" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "parent_product_id" varchar(80);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "other_stocks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- -- ALTER TABLE "users" ADD COLUMN "activity" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
-- ALTER TABLE "users" ADD COLUMN "page_website" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
-- ALTER TABLE "users" ADD COLUMN "national_code" varchar(20) DEFAULT '' NOT NULL;--> statement-breakpoint
-- ALTER TABLE "users" ADD COLUMN "birth_date" varchar(20) DEFAULT '' NOT NULL;--> statement-breakpoint
-- ALTER TABLE "users" ADD COLUMN "father_name" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
-- ALTER TABLE "users" ADD COLUMN "is_verified_identity" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "attributes_name_key" ON "attributes" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "products_parent_idx" ON "products" USING btree ("parent_product_id");
