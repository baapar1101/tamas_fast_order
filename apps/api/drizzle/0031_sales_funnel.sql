CREATE TABLE "funnel_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" varchar(40) NOT NULL,
	"user_id" integer,
	"type" varchar(24) NOT NULL,
	"product_id" varchar(120),
	"path" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"order_id" integer,
	"channels" varchar(60) DEFAULT '' NOT NULL,
	"delivered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_carts" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"last_reminded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_messages" ADD CONSTRAINT "funnel_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_messages" ADD CONSTRAINT "funnel_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_carts" ADD CONSTRAINT "user_carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funnel_events_type_created_idx" ON "funnel_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "funnel_events_user_created_idx" ON "funnel_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "funnel_events_created_idx" ON "funnel_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "funnel_messages_user_kind_idx" ON "funnel_messages" USING btree ("user_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "funnel_messages_created_idx" ON "funnel_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_messages_order_kind_key" ON "funnel_messages" USING btree ("order_id","kind");--> statement-breakpoint
CREATE INDEX "user_carts_updated_idx" ON "user_carts" USING btree ("updated_at");