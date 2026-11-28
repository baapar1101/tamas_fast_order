-- Incoming SMS pulled from the Payam Resan inbox (GetInbox returns each message
-- once), stored before anything else so a message is never lost.
CREATE TABLE IF NOT EXISTS "sms_inbox_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" varchar(24) DEFAULT 'payamresan' NOT NULL,
  "provider_message_id" varchar(64) NOT NULL,
  "from_number" varchar(32) NOT NULL,
  "from_phone" varchar(15),
  "to_number" varchar(32) NOT NULL,
  "body" text NOT NULL,
  "provider_time" varchar(40) DEFAULT '' NOT NULL,
  "received_at" timestamp with time zone NOT NULL,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "handled_at" timestamp with time zone,
  "handled_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sms_inbox_provider_message_key" ON "sms_inbox_messages" ("provider", "provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_inbox_received_idx" ON "sms_inbox_messages" ("received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_inbox_from_phone_idx" ON "sms_inbox_messages" ("from_phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_inbox_user_idx" ON "sms_inbox_messages" ("user_id");
