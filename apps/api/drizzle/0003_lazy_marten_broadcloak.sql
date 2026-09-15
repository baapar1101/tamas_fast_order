CREATE TYPE "public"."payment_status" AS ENUM('paid', 'unpaid', 'pending');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sub_title" varchar(400);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "keywords" varchar(500);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "slug" varchar(200);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ribbon" varchar(50);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "type" varchar(50) DEFAULT 'physical' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "dimensions" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tracking" boolean DEFAULT true NOT NULL;