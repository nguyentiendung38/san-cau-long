ALTER TABLE "booking_requests" ADD COLUMN "customerId" TEXT REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "booking_requests"
SET "customerId" = (
    SELECT "customers"."id"
    FROM "customers"
    WHERE "customers"."phone" = "booking_requests"."phone"
    LIMIT 1
)
WHERE "customerId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "customers"
    WHERE "customers"."phone" = "booking_requests"."phone"
  );
