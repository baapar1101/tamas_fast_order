ALTER TABLE "uploads" ADD COLUMN "private_scope" varchar(20);--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "private_owner_id" integer;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_private_owner_id_users_id_fk" FOREIGN KEY ("private_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_private_owner_idx" ON "uploads" USING btree ("private_owner_id");--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_private_scope_check" CHECK ("uploads"."private_scope" IS NULL OR "uploads"."private_scope" IN ('credit', 'payment'));