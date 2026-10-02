-- Listing.reviewStatus: Lodgist's decision to approve a home for public display.
-- APPROVED is "Lodgist-reviewed". It is not verification.
-- This migration does not set APPROVED. Listing.status VERIFIED, RiskState
-- VERIFIED, and Paystack charge.success do not approve or verify a listing.
-- New rows default to NOT_REVIEWED.
--
-- Deploy this before the API revision that selects reviewStatus.

DO $$ BEGIN
  CREATE TYPE "ListingReviewStatus" AS ENUM ('NOT_REVIEWED', 'APPROVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "reviewStatus" "ListingReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED';
