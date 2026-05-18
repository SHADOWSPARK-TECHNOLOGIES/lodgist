-- Add paystackReference to Booking for Paystack-initiated payment flows.
-- Distinct from manualPaymentRef (used for bank transfers / admin-verified payments).
-- Unique constraint enables idempotent webhook lookups without table scans.

ALTER TABLE "Booking" ADD COLUMN "paystackReference" TEXT;

CREATE UNIQUE INDEX "Booking_paystackReference_key" ON "Booking"("paystackReference");
