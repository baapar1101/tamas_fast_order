ALTER TABLE "orders" ADD COLUMN "subtotal" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "orders" SET "subtotal" = "total";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_plan" jsonb;
