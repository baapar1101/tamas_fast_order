ALTER TABLE "attributes" ADD COLUMN "type" varchar(20) DEFAULT 'text' NOT NULL;
--> statement-breakpoint
ALTER TABLE "attributes" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb NOT NULL;