ALTER TABLE "booking_requests" ADD COLUMN "cancellationRequestStatus" TEXT;
ALTER TABLE "booking_requests" ADD COLUMN "cancellationRequestReason" TEXT;
ALTER TABLE "booking_requests" ADD COLUMN "cancellationRequestedAt" DATETIME;
ALTER TABLE "booking_requests" ADD COLUMN "cancellationReviewedAt" DATETIME;
