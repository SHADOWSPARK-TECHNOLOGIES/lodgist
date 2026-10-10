-- Additive columns for a rental-check fee reference and the staff review of that reference.
-- Do not run this against production from an agent session.
-- A stored reference is not a receipt. paymentStatus stays unpaid until staff confirm.

ALTER TABLE "RentalCheck" ADD COLUMN IF NOT EXISTS "manualPaymentRef" TEXT;
ALTER TABLE "RentalCheck" ADD COLUMN IF NOT EXISTS "paymentSubmittedAt" TIMESTAMP(3);
ALTER TABLE "RentalCheck" ADD COLUMN IF NOT EXISTS "paymentReviewedBy" INTEGER;
ALTER TABLE "RentalCheck" ADD COLUMN IF NOT EXISTS "paymentReviewedAt" TIMESTAMP(3);
ALTER TABLE "RentalCheck" ADD COLUMN IF NOT EXISTS "paymentReviewNote" TEXT;
