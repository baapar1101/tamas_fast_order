CREATE TABLE "customer_chat_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_token_hash" varchar(64) NOT NULL,
	"user_id" integer,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) DEFAULT '' NOT NULL,
	"email" varchar(200),
	"phone" varchar(20) NOT NULL,
	"page_url" text,
	"device_type" varchar(20) DEFAULT 'desktop' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_role" varchar(20) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_chat_conversations" ADD CONSTRAINT "customer_chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_chat_messages" ADD CONSTRAINT "customer_chat_messages_conversation_id_customer_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."customer_chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_chat_conversations_token_key" ON "customer_chat_conversations" USING btree ("visitor_token_hash");--> statement-breakpoint
CREATE INDEX "customer_chat_conversations_status_idx" ON "customer_chat_conversations" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "customer_chat_conversations_user_idx" ON "customer_chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customer_chat_messages_conversation_idx" ON "customer_chat_messages" USING btree ("conversation_id","created_at");