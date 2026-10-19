ALTER TABLE "booking_requests" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "booking_requests" ADD COLUMN "transferReference" TEXT;

UPDATE "booking_requests"
SET "expiresAt" = datetime("createdAt", '+30 minutes')
WHERE "paymentMethod" = 'DEPOSIT_TRANSFER';

CREATE UNIQUE INDEX "booking_requests_transferReference_key" ON "booking_requests"("transferReference");
CREATE INDEX "booking_requests_status_paymentMethod_expiresAt_idx" ON "booking_requests"("status", "paymentMethod", "expiresAt");

CREATE TABLE "customer_favorite_venues" (
    "customerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("customerId", "venueId"),
    CONSTRAINT "customer_favorite_venues_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_favorite_venues_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "customer_favorite_courts" (
    "customerId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("customerId", "courtId"),
    CONSTRAINT "customer_favorite_courts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_favorite_courts_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "courts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "maintenance_closures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courtId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_closures_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "courts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "maintenance_closures_courtId_startAt_endAt_idx" ON "maintenance_closures"("courtId", "startAt", "endAt");

CREATE TABLE "email_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dedupeKey" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "sentAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "email_notifications_dedupeKey_key" ON "email_notifications"("dedupeKey");
CREATE INDEX "email_notifications_status_nextAttemptAt_idx" ON "email_notifications"("status", "nextAttemptAt");
