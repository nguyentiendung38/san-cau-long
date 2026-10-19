ALTER TABLE "booking_requests" ADD COLUMN "cancellationRequestType" TEXT;
ALTER TABLE "booking_requests" ADD COLUMN "requestedDate" DATETIME;
ALTER TABLE "booking_requests" ADD COLUMN "requestedStartTime" TEXT;
ALTER TABLE "booking_requests" ADD COLUMN "requestedEndTime" TEXT;

ALTER TABLE "bookings" ADD COLUMN "checkInToken" TEXT;
ALTER TABLE "bookings" ADD COLUMN "checkedInById" TEXT;
CREATE UNIQUE INDEX "bookings_checkInToken_key" ON "bookings"("checkInToken");

ALTER TABLE "venue_reviews" ADD COLUMN "customerId" TEXT;
ALTER TABLE "venue_reviews" ADD COLUMN "bookingId" TEXT REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "venue_reviews_bookingId_key" ON "venue_reviews"("bookingId");
