CREATE TYPE "public"."installment_receipt_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "installment_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"installment_index" integer NOT NULL,
	"amount" bigint NOT NULL,
	"due_date" varchar(30) NOT NULL,
	"receipt_url" text NOT NULL,
	"tracking_code" varchar(120),
	"note" text,
	"status" "installment_receipt_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment_reminder_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"installment_index" integer NOT NULL,
	"reminder_date" varchar(10) NOT NULL,
	"reminder_slot" integer NOT NULL,
	"delivered_channels" jsonb DEFAULT '{"telegram":false,"bale":false,"sms":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "installment_receipts" ADD CONSTRAINT "installment_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_receipts" ADD CONSTRAINT "installment_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_receipts" ADD CONSTRAINT "installment_receipts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_reminder_deliveries" ADD CONSTRAINT "installment_reminder_deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_reminder_deliveries" ADD CONSTRAINT "installment_reminder_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "installment_receipts_order_installment_key" ON "installment_receipts" USING btree ("order_id","installment_index");--> statement-breakpoint
CREATE INDEX "installment_receipts_user_idx" ON "installment_receipts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "installment_receipts_status_idx" ON "installment_receipts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "installment_receipts_due_date_idx" ON "installment_receipts" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "installment_reminders_daily_slot_key" ON "installment_reminder_deliveries" USING btree ("user_id","reminder_date","reminder_slot");--> statement-breakpoint
CREATE INDEX "installment_reminders_user_idx" ON "installment_reminder_deliveries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "installment_reminders_date_idx" ON "installment_reminder_deliveries" USING btree ("reminder_date");