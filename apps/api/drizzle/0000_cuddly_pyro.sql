CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."sync_side" AS ENUM('db', 'sheet');--> statement-breakpoint
CREATE TYPE "public"."upload_kind" AS ENUM('product', 'brand', 'category', 'slide', 'certificate', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."warehouse" AS ENUM('kerman', 'tehran', 'site');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"action" varchar(80) NOT NULL,
	"entity" varchar(60) NOT NULL,
	"entity_key" varchar(200),
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"fa_name" varchar(160) DEFAULT '' NOT NULL,
	"icon_url" varchar(1000),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"fa_name" varchar(160) DEFAULT '' NOT NULL,
	"icon_url" varchar(1000),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "category_brands" (
	"category_id" integer NOT NULL,
	"brand_id" integer NOT NULL,
	CONSTRAINT "category_brands_category_id_brand_id_pk" PRIMARY KEY("category_id","brand_id")
);
--> statement-breakpoint
CREATE TABLE "colors" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(160),
	"fa_name" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" varchar(80) NOT NULL,
	"sku" varchar(80),
	"title" varchar(400) NOT NULL,
	"color" varchar(160),
	"price" bigint DEFAULT 0 NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"warehouse" "warehouse" DEFAULT 'kerman' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_code" varchar(40) NOT NULL,
	"user_id" integer,
	"customer_name" varchar(300) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"store_name" varchar(200),
	"address" text DEFAULT '' NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"payment_method" varchar(100),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(15) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_ip" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" varchar(80) NOT NULL,
	"sku" varchar(80),
	"title" varchar(400) NOT NULL,
	"model" varchar(400),
	"category_id" integer,
	"brand_id" integer,
	"color" varchar(160),
	"color_en" varchar(160),
	"color_code" varchar(32),
	"price" bigint DEFAULT 0 NOT NULL,
	"old_price" bigint,
	"discount" integer DEFAULT 0 NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"kerman_stock" integer DEFAULT 0 NOT NULL,
	"tehran_stock" integer DEFAULT 0 NOT NULL,
	"warranty" varchar(300),
	"sell_type" varchar(200),
	"seller" varchar(200),
	"promotion" boolean DEFAULT false NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"image_url" varchar(1000),
	"gallery" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"user_id" integer NOT NULL,
	"user_agent" varchar(400),
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(120) NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_conflicts" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" varchar(40) NOT NULL,
	"entity_key" varchar(200) NOT NULL,
	"field" varchar(120) NOT NULL,
	"db_value" text,
	"sheet_value" text,
	"resolved_to" "sync_side" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"entity" varchar(40) PRIMARY KEY NOT NULL,
	"last_pulled_at" timestamp with time zone,
	"last_pushed_at" timestamp with time zone,
	"rows_pulled" integer DEFAULT 0 NOT NULL,
	"rows_pushed" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"running" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "upload_kind" DEFAULT 'other' NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"thumb_key" varchar(500),
	"original_name" varchar(400) DEFAULT '' NOT NULL,
	"mime_type" varchar(120) DEFAULT '' NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" varchar(64),
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(15) NOT NULL,
	"name" varchar(120) DEFAULT '' NOT NULL,
	"last_name" varchar(120) DEFAULT '' NOT NULL,
	"store_name" varchar(200) DEFAULT '' NOT NULL,
	"landline" varchar(40) DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"postal_code" varchar(20) DEFAULT '' NOT NULL,
	"certificate_file_url" varchar(1000) DEFAULT '' NOT NULL,
	"activity" varchar(120) DEFAULT '' NOT NULL,
	"page_website" varchar(255) DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sheet_hash" varchar(64),
	"sheet_synced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_brands" ADD CONSTRAINT "category_brands_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_brands" ADD CONSTRAINT "category_brands_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_key" ON "brands" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_key" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "colors_code_key" ON "colors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_code_key" ON "orders" USING btree ("order_code");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "otp_expires_idx" ON "otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_product_id_key" ON "products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_title_idx" ON "products" USING btree ("title");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_promotion_idx" ON "products" USING btree ("promotion");--> statement-breakpoint
CREATE INDEX "products_updated_idx" ON "products" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_key_key" ON "settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "sync_conflicts_entity_idx" ON "sync_conflicts" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "sync_conflicts_created_idx" ON "sync_conflicts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "uploads_kind_idx" ON "uploads" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "uploads_checksum_idx" ON "uploads" USING btree ("checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");