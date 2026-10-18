CREATE TYPE "public"."discount_kind" AS ENUM('percent', 'fixed', 'free_shipping');--> statement-breakpoint
CREATE TYPE "public"."payment_instruction_status" AS ENUM('pending', 'sent');--> statement-breakpoint
CREATE TABLE "customer_bale_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bale_user_id" varchar(32) NOT NULL,
	"chat_id" varchar(32) NOT NULL,
	"username" varchar(120),
	"first_name" varchar(160),
	"last_name" varchar(160),
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"notification_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_interaction_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_bale_link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" varchar(40) NOT NULL,
	"kind" "discount_kind" NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"min_order_amount" bigint DEFAULT 0 NOT NULL,
	"max_discount_amount" bigint,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_limit" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"discount_code_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"free_shipping" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_payment_instructions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" "payment_instruction_status" DEFAULT 'pending' NOT NULL,
	"account_id" varchar(80),
	"instructions" text,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_by" integer,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" varchar(40);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "free_shipping" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_bale_accounts" ADD CONSTRAINT "customer_bale_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_bale_link_tokens" ADD CONSTRAINT "customer_bale_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payment_instructions" ADD CONSTRAINT "order_payment_instructions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payment_instructions" ADD CONSTRAINT "order_payment_instructions_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_bale_accounts_user_key" ON "customer_bale_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_bale_accounts_bale_user_key" ON "customer_bale_accounts" USING btree ("bale_user_id");--> statement-breakpoint
CREATE INDEX "customer_bale_accounts_chat_idx" ON "customer_bale_accounts" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_bale_link_tokens_hash_key" ON "customer_bale_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_bale_link_tokens_user_idx" ON "customer_bale_link_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customer_bale_link_tokens_expires_idx" ON "customer_bale_link_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discount_codes_user_idx" ON "discount_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "discount_codes_active_idx" ON "discount_codes" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_redemptions_order_key" ON "discount_redemptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "discount_redemptions_code_idx" ON "discount_redemptions" USING btree ("discount_code_id");--> statement-breakpoint
CREATE INDEX "discount_redemptions_user_idx" ON "discount_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payment_instructions_order_key" ON "order_payment_instructions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_payment_instructions_status_idx" ON "order_payment_instructions" USING btree ("status");