CREATE TYPE "public"."credit_report_extraction_status" AS ENUM('parsed', 'needs_review', 'failed');--> statement-breakpoint
CREATE TABLE "credit_report_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"credit_application_id" integer,
	"file_url" text NOT NULL,
	"original_name" varchar(400) DEFAULT '' NOT NULL,
	"report_number" varchar(80),
	"report_date" varchar(40),
	"extracted_national_id" varchar(20),
	"extracted_full_name" varchar(240),
	"extracted_mobile" varchar(20),
	"score" integer,
	"risk_grade" varchar(20),
	"risk_level" varchar(80),
	"good_payer_min_basis_points" integer,
	"good_payer_max_basis_points" integer,
	"bounced_cheque_count" integer,
	"extraction_status" "credit_report_extraction_status" DEFAULT 'parsed' NOT NULL,
	"extraction_version" integer DEFAULT 1 NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_report_snapshots" ADD CONSTRAINT "credit_report_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_report_snapshots" ADD CONSTRAINT "credit_report_snapshots_credit_application_id_credit_applications_id_fk" FOREIGN KEY ("credit_application_id") REFERENCES "public"."credit_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_report_snapshots_user_idx" ON "credit_report_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_report_snapshots_application_idx" ON "credit_report_snapshots" USING btree ("credit_application_id");--> statement-breakpoint
CREATE INDEX "credit_report_snapshots_expires_idx" ON "credit_report_snapshots" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "credit_report_snapshots_report_user_idx" ON "credit_report_snapshots" USING btree ("user_id","report_number");