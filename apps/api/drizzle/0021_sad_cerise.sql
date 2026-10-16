CREATE TABLE "customer_telegram_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"telegram_user_id" varchar(32) NOT NULL,
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
CREATE TABLE "customer_telegram_link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_telegram_accounts" ADD CONSTRAINT "customer_telegram_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_telegram_link_tokens" ADD CONSTRAINT "customer_telegram_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_telegram_accounts_user_key" ON "customer_telegram_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_telegram_accounts_telegram_user_key" ON "customer_telegram_accounts" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "customer_telegram_accounts_chat_idx" ON "customer_telegram_accounts" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_telegram_link_tokens_hash_key" ON "customer_telegram_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_telegram_link_tokens_user_idx" ON "customer_telegram_link_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customer_telegram_link_tokens_expires_idx" ON "customer_telegram_link_tokens" USING btree ("expires_at");