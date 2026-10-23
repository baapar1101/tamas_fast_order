CREATE TABLE "document_reupload_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_upload_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"requested_by" integer,
	"document_label" varchar(400) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"notification_delivery" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_reupload_status_check" CHECK ("document_reupload_requests"."status" IN ('pending', 'submitted', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "document_reupload_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"upload_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer,
	"review_note" text,
	CONSTRAINT "document_reupload_submission_status_check" CHECK ("document_reupload_submissions"."status" IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "document_reupload_requests" ADD CONSTRAINT "document_reupload_requests_original_upload_id_uploads_id_fk" FOREIGN KEY ("original_upload_id") REFERENCES "public"."uploads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reupload_requests" ADD CONSTRAINT "document_reupload_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reupload_requests" ADD CONSTRAINT "document_reupload_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reupload_submissions" ADD CONSTRAINT "document_reupload_submissions_request_id_document_reupload_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."document_reupload_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reupload_submissions" ADD CONSTRAINT "document_reupload_submissions_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reupload_submissions" ADD CONSTRAINT "document_reupload_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_reupload_user_idx" ON "document_reupload_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_reupload_open_idx" ON "document_reupload_requests" USING btree ("original_upload_id") WHERE "document_reupload_requests"."status" IN ('pending', 'submitted');--> statement-breakpoint
CREATE INDEX "document_reupload_submission_request_idx" ON "document_reupload_submissions" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_reupload_pending_submission_idx" ON "document_reupload_submissions" USING btree ("request_id") WHERE "document_reupload_submissions"."status" = 'pending';