CREATE TYPE "public"."investment_entry_status" AS ENUM('paid', 'pending', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."investment_entry_type" AS ENUM('capital_injection', 'capital_withdrawal', 'purchase', 'expense', 'profit_distribution', 'adjustment');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'investor';--> statement-breakpoint
CREATE TABLE "investment_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "investment_entry_type" NOT NULL,
	"status" "investment_entry_status" DEFAULT 'paid' NOT NULL,
	"amount" bigint NOT NULL,
	"title" varchar(240) NOT NULL,
	"category" varchar(120),
	"reference" varchar(160),
	"notes" text,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cost_price" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost_price" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_entries" ADD CONSTRAINT "investment_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investment_entries_type_idx" ON "investment_entries" USING btree ("type");--> statement-breakpoint
CREATE INDEX "investment_entries_status_idx" ON "investment_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "investment_entries_date_idx" ON "investment_entries" USING btree ("transaction_date");