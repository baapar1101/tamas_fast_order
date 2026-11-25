-- Conversation state of the customer bot (Telegram/Bale): OTP login, profile
-- questions, credit documents and checkout choices survive a redeploy.
CREATE TABLE IF NOT EXISTS "customer_bot_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "platform" varchar(16) NOT NULL,
  "bot_user_id" varchar(32) NOT NULL,
  "chat_id" varchar(32) NOT NULL,
  "state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_bot_sessions_user_key" ON "customer_bot_sessions" ("platform", "bot_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_bot_sessions_expires_idx" ON "customer_bot_sessions" ("expires_at");
