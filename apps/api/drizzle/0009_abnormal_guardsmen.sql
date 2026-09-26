CREATE TYPE "public"."cheque_status" AS ENUM('pending', 'passed', 'bounced', 'returned');--> statement-breakpoint
CREATE TYPE "public"."credit_status" AS ENUM('pending', 'reviewing', 'active', 'action_required');--> statement-breakpoint
CREATE TABLE "credit_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"national_id" varchar(20) NOT NULL,
	"business_type" varchar(100) NOT NULL,
	"national_card_url" text NOT NULL,
	"business_docs_url" text NOT NULL,
	"check_image_url" text NOT NULL,
	"bank_statement_url" text,
	"referral_info" text,
	"status" "credit_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"admin_credit_score" integer DEFAULT 0 NOT NULL,
	"assigned_credit_limit" bigint DEFAULT 0 NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_cheques" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"credit_application_id" integer,
	"order_id" integer,
	"cheque_number" varchar(80) NOT NULL,
	"bank_name" varchar(120) NOT NULL,
	"account_holder" varchar(160) NOT NULL,
	"amount" bigint NOT NULL,
	"due_date" varchar(30) NOT NULL,
	"status" "cheque_status" DEFAULT 'pending' NOT NULL,
	"image_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "bundle_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cheques" ADD CONSTRAINT "credit_cheques_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cheques" ADD CONSTRAINT "credit_cheques_credit_application_id_credit_applications_id_fk" FOREIGN KEY ("credit_application_id") REFERENCES "public"."credit_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cheques" ADD CONSTRAINT "credit_cheques_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_applications_user_idx" ON "credit_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_applications_status_idx" ON "credit_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_cheques_user_idx" ON "credit_cheques" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_cheques_status_idx" ON "credit_cheques" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_cheques_due_date_idx" ON "credit_cheques" USING btree ("due_date");