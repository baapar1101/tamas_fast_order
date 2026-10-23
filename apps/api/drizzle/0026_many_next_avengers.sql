ALTER TABLE "investment_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "investment_entries" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "users" SET "role" = 'customer' WHERE "role" = 'investor';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer'::text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin', 'operator');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
DROP INDEX "products_investor_financed_idx";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "investor_financed";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "investor_financed";--> statement-breakpoint
DROP TYPE "public"."investment_entry_status";--> statement-breakpoint
DROP TYPE "public"."investment_entry_type";
