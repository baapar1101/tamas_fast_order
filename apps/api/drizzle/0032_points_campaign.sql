ALTER TABLE "order_items" ADD COLUMN "campaign_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "campaign_points" integer DEFAULT 0 NOT NULL;