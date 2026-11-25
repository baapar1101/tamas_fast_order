CREATE TABLE "sms_campaigns" (
  "id" serial PRIMARY KEY NOT NULL,
  "request_id" varchar(36) NOT NULL,
  "body" text NOT NULL,
  "audience" varchar(12) NOT NULL,
  "status" varchar(20) DEFAULT 'queued' NOT NULL,
  "total" integer NOT NULL,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE UNIQUE INDEX "sms_campaigns_request_key" ON "sms_campaigns" ("request_id");--> statement-breakpoint
CREATE INDEX "sms_campaigns_created_idx" ON "sms_campaigns" ("created_at");--> statement-breakpoint
CREATE TABLE "sms_campaign_deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "campaign_id" integer NOT NULL REFERENCES "sms_campaigns"("id") ON DELETE CASCADE,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "phone_hash" varchar(64) NOT NULL,
  "status" varchar(20) DEFAULT 'queued' NOT NULL,
  "error" varchar(200),
  "processing_at" timestamp with time zone,
  "sent_at" timestamp with time zone
);--> statement-breakpoint
CREATE UNIQUE INDEX "sms_campaign_delivery_user_key" ON "sms_campaign_deliveries" ("campaign_id", "user_id");--> statement-breakpoint
CREATE INDEX "sms_campaign_delivery_queue_idx" ON "sms_campaign_deliveries" ("status", "id");--> statement-breakpoint
CREATE INDEX "sms_campaign_delivery_campaign_idx" ON "sms_campaign_deliveries" ("campaign_id");
