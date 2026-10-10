CREATE TYPE "public"."inventory_reservation_status" AS ENUM('reserved', 'committed', 'released');--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"warehouse" "warehouse" NOT NULL,
	"quantity" integer NOT NULL,
	"status" "inventory_reservation_status" DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservations_order_product_warehouse_key" ON "inventory_reservations" USING btree ("order_id","product_id","warehouse");--> statement-breakpoint
CREATE INDEX "inventory_reservations_order_status_idx" ON "inventory_reservations" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "inventory_reservations_product_status_idx" ON "inventory_reservations" USING btree ("product_id","status");
--> statement-breakpoint
WITH inventory_lines AS (
	SELECT
		oi.order_id,
		p.id AS product_id,
		CASE WHEN (p.kerman_stock + p.tehran_stock) > 0 THEN oi.warehouse ELSE 'site'::warehouse END AS warehouse,
		oi.qty AS quantity,
		CASE WHEN o.status = 'new' THEN 'reserved'::inventory_reservation_status ELSE 'committed'::inventory_reservation_status END AS status,
		o.created_at
	FROM order_items oi
	JOIN orders o ON o.id = oi.order_id
	JOIN products p ON p.product_id = oi.product_id
	WHERE o.status <> 'cancelled'
		AND (p.type <> 'bundle' OR COALESCE(jsonb_array_length(p.bundle_items), 0) = 0)

	UNION ALL

	SELECT
		oi.order_id,
		component.id AS product_id,
		CASE WHEN (component.kerman_stock + component.tehran_stock) > 0 THEN oi.warehouse ELSE 'site'::warehouse END AS warehouse,
		oi.qty * GREATEST(1, COALESCE((bundle_item.value->>'qty')::integer, 1)) AS quantity,
		CASE WHEN o.status = 'new' THEN 'reserved'::inventory_reservation_status ELSE 'committed'::inventory_reservation_status END AS status,
		o.created_at
	FROM order_items oi
	JOIN orders o ON o.id = oi.order_id
	JOIN products bundle ON bundle.product_id = oi.product_id AND bundle.type = 'bundle'
	CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bundle.bundle_items, '[]'::jsonb)) AS bundle_item(value)
	JOIN products component ON component.product_id = bundle_item.value->>'productId'
	WHERE o.status <> 'cancelled'
)
INSERT INTO inventory_reservations (order_id, product_id, warehouse, quantity, status, created_at, updated_at, committed_at)
SELECT
	order_id,
	product_id,
	warehouse,
	SUM(quantity)::integer,
	status,
	MIN(created_at),
	NOW(),
	CASE WHEN status = 'committed' THEN NOW() ELSE NULL END
FROM inventory_lines
GROUP BY order_id, product_id, warehouse, status
ON CONFLICT (order_id, product_id, warehouse) DO NOTHING;
