CREATE TABLE "native_push_devices" (
	"installation_id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_hash" varchar(64) NOT NULL,
	"token" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "native_push_devices" ADD CONSTRAINT "native_push_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "native_push_devices_user_idx" ON "native_push_devices" USING btree ("user_id");