ALTER TABLE "products" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "external_data_updated_at" timestamp with time zone;