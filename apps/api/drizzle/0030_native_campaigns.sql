CREATE TABLE "native_campaign_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"user_id" integer,
	"installation_id" varchar(36),
	"token_hash" varchar(64),
	"session_hash" varchar(64),
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" varchar(120),
	"provider_message_id" varchar(240),
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"processing_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "native_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(80) NOT NULL,
	"body" text NOT NULL,
	"destination" varchar(30) NOT NULL,
	"audience" varchar(12) NOT NULL,
	"user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"queued_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "native_campaign_deliveries" ADD CONSTRAINT "native_campaign_deliveries_campaign_id_native_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."native_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_campaign_deliveries" ADD CONSTRAINT "native_campaign_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_campaigns" ADD CONSTRAINT "native_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "native_campaign_delivery_device_key" ON "native_campaign_deliveries" USING btree ("campaign_id","installation_id");--> statement-breakpoint
CREATE INDEX "native_campaign_delivery_queue_idx" ON "native_campaign_deliveries" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "native_campaign_delivery_campaign_idx" ON "native_campaign_deliveries" USING btree ("campaign_id","id");--> statement-breakpoint
CREATE INDEX "native_campaign_delivery_user_idx" ON "native_campaign_deliveries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "native_campaigns_created_idx" ON "native_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "native_campaigns_status_idx" ON "native_campaigns" USING btree ("status");