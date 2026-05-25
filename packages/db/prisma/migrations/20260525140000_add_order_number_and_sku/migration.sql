-- Add orderNumber to Order: add nullable, backfill, then enforce
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;
UPDATE "Order" o
  SET "orderNumber" = 'ECM-' || to_char(o."createdAt", 'YYYYMMDD') || '-' || upper(right(o."id", 6))
  FROM "Order" o2 WHERE o.id = o2.id;
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- Add sku to Product: add nullable, backfill, then enforce
ALTER TABLE "Product" ADD COLUMN "sku" TEXT;
UPDATE "Product" p
  SET "sku" = 'SKU-' || lpad(sub.rn::text, 4, '0')
  FROM (SELECT id, row_number() OVER (ORDER BY "createdAt") as rn FROM "Product") sub
  WHERE p.id = sub.id;
ALTER TABLE "Product" ALTER COLUMN "sku" SET NOT NULL;
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
