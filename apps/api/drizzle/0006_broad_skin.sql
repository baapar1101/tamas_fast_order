CREATE TYPE "public"."crm_sync_action" AS ENUM('create', 'update', 'delete', 'sync');--> statement-breakpoint
CREATE TYPE "public"."crm_sync_entity" AS ENUM('order', 'product', 'person', 'chat_message');--> statement-breakpoint
CREATE TYPE "public"."crm_sync_status" AS ENUM('success', 'error', 'pending', 'skipped');--> statement-breakpoint
CREATE TABLE "crm_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" "crm_sync_entity" NOT NULL,
	"entity_key" varchar(200) NOT NULL,
	"action" "crm_sync_action" NOT NULL,
	"status" "crm_sync_status" NOT NULL,
	"remote_id" varchar(200),
	"error" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE INDEX "crm_sync_logs_entity_idx" ON "crm_sync_logs" USING btree ("entity","entity_key");--> statement-breakpoint
CREATE INDEX "crm_sync_logs_status_idx" ON "crm_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crm_sync_logs_created_idx" ON "crm_sync_logs" USING btree ("created_at");