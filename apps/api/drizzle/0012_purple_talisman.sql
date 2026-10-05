ALTER TABLE "orders" ADD COLUMN "acquisition_source" varchar(120);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "acquisition_medium" varchar(120);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "acquisition_campaign" varchar(200);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "acquisition_referrer" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "acquisition_landing_page" text;--> statement-breakpoint
CREATE INDEX "orders_acquisition_source_idx" ON "orders" USING btree ("acquisition_source");