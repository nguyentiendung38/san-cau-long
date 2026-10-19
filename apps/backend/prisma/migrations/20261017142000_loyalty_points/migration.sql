ALTER TABLE "customers" ADD COLUMN "reservedPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "booking_requests" ADD COLUMN "redeemPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booking_requests" ADD COLUMN "loyaltyDiscountAmount" REAL NOT NULL DEFAULT 0;

CREATE TABLE "points_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "points_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "points_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "points_transactions_idempotencyKey_key" ON "points_transactions"("idempotencyKey");
CREATE INDEX "points_transactions_customerId_createdAt_idx" ON "points_transactions"("customerId", "createdAt");
