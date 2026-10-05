ALTER TABLE "slides" ADD COLUMN "mobile_image_url" varchar(1000);
--> statement-breakpoint
INSERT INTO "slides" ("title", "image_url", "mobile_image_url", "link_url", "sort_order", "is_active")
SELECT seed.*
FROM (VALUES
	('گوشی‌های اپل', '/assets/slides/slide-01.jpg', NULL, '/?brand=Apple', 30, true),
	('گوشی‌های شیائومی', '/assets/slides/slide-02.jpg', NULL, '/?brand=Xiaomi', 20, true),
	('گوشی‌های سامسونگ', '/assets/slides/slide-03.jpg', NULL, '/?brand=Samsung', 10, true)
) AS seed("title", "image_url", "mobile_image_url", "link_url", "sort_order", "is_active")
WHERE NOT EXISTS (SELECT 1 FROM "slides");
