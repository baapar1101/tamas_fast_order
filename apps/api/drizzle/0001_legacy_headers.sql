ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activity" varchar(120) DEFAULT '' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "page_website" varchar(255) DEFAULT '' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" varchar(100);
