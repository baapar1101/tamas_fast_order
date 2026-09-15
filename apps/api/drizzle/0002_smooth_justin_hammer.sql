CREATE TABLE "slides" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255),
	"image_url" varchar(1000) NOT NULL,
	"link_url" varchar(1000),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "slides_active_sort_idx" ON "slides" USING btree ("is_active","sort_order");