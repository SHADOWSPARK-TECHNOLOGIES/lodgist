-- Phase B: admin publish review and a separate verified badge.
-- Publish stays on existing Listing.reviewStatus (APPROVED) and Listing.status.
-- APPROVED is still "Lodgist-reviewed", not "Verified by Lodgist".
-- The badge requires evidenceVerified = true plus verifiedAt and verifiedById,
-- set only by a STUDIO_ADMIN action. These columns are nullable. Existing rows
-- stay unverified. This does not set any listing to APPROVED or verified.
--
-- Audit rows are appended to Listing.adminAudit (JSON). The AdminAction model
-- and the other trust-layer tables are schema drift with no migration. They
-- are intentionally not created here.
--
-- verifiedById stores the acting User id and has no foreign key.

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "evidenceVerified" BOOLEAN;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "verifiedById" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "adminAudit" JSONB;
