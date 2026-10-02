-- Listing state dimensions (additive).
--
-- Does not drop or rewrite Listing.status or Listing.riskState.
-- Does not set verification to CHECKS_COMPLETED, PARTIALLY_CHECKED, EXPIRED,
-- or REVOKED. ListingStatus.VERIFIED and RiskState.VERIFIED are not evidence.
-- Does not set availability to anything other than UNKNOWN. availableFrom is
-- not treated as inventory confirmation.
-- Does not invent AUTHORIZED_IMPORT, EXTERNAL_REFERENCE, or EXACT precision.
-- Samples stay a JSON flag (totalMoveInCost.sample). This migration does not
-- read that flag and does not mark sample rows verified.
--
-- Backfill for existing rows:
--   origin: DIRECT_SUBMISSION (there is no source column).
--   publication:
--     status REJECTED or ARCHIVED -> REMOVED
--     isFlaggedForFraud, or riskState FLAGGED or SUSPENDED -> SUSPENDED
--     status PENDING or VERIFIED -> PUBLISHED
--     anything else -> REVIEW
--   availability: UNKNOWN
--   verification:
--     riskState UNDER_REVIEW -> PENDING
--     otherwise NOT_CHECKED
--   locationPrecision: UNKNOWN
--     (the public API still returns a snapped area, never an exact pin)
--   actionEligibility:
--     status VERIFIED and not fraud-flagged -> VIEWING_REQUEST
--     status PENDING and not fraud-flagged -> ENQUIRY
--     otherwise SOURCE_LINK_ONLY
--
-- New inserts use the column defaults: direct submission, published,
-- availability unknown, not checked, location precision unknown, enquiry.
-- That matches a new PENDING listing. A later status change must set
-- actionEligibility itself; this migration does not add a trigger.
--
-- Deploy: apply this migration before the API revision that selects these
-- columns. GET /api/listings selects them the same way it selects riskState.

DO $$ BEGIN
  CREATE TYPE "ListingOrigin" AS ENUM ('DIRECT_SUBMISSION', 'AUTHORIZED_IMPORT', 'EXTERNAL_REFERENCE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ListingPublication" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'SUSPENDED', 'REMOVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ListingAvailability" AS ENUM ('UNKNOWN', 'REPORTED_AVAILABLE', 'RECENTLY_CONFIRMED', 'UNAVAILABLE', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ListingVerification" AS ENUM ('NOT_CHECKED', 'PENDING', 'PARTIALLY_CHECKED', 'CHECKS_COMPLETED', 'EXPIRED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ListingLocationPrecision" AS ENUM ('EXACT', 'APPROXIMATE', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ListingActionEligibility" AS ENUM ('SOURCE_LINK_ONLY', 'ENQUIRY', 'VIEWING_REQUEST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "origin" "ListingOrigin" NOT NULL DEFAULT 'DIRECT_SUBMISSION';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "publication" "ListingPublication" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "availability" "ListingAvailability" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "verification" "ListingVerification" NOT NULL DEFAULT 'NOT_CHECKED';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "locationPrecision" "ListingLocationPrecision" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "actionEligibility" "ListingActionEligibility" NOT NULL DEFAULT 'ENQUIRY';

UPDATE "Listing" SET
  "origin" = 'DIRECT_SUBMISSION',
  "availability" = 'UNKNOWN',
  "locationPrecision" = 'UNKNOWN',
  "publication" = CASE
    WHEN "status"::text IN ('REJECTED', 'ARCHIVED') THEN 'REMOVED'::"ListingPublication"
    WHEN "isFlaggedForFraud" = true OR "riskState"::text IN ('FLAGGED', 'SUSPENDED') THEN 'SUSPENDED'::"ListingPublication"
    WHEN "status"::text IN ('PENDING', 'VERIFIED') THEN 'PUBLISHED'::"ListingPublication"
    ELSE 'REVIEW'::"ListingPublication"
  END,
  "verification" = CASE
    WHEN "riskState"::text = 'UNDER_REVIEW' THEN 'PENDING'::"ListingVerification"
    ELSE 'NOT_CHECKED'::"ListingVerification"
  END,
  "actionEligibility" = CASE
    WHEN "status"::text = 'VERIFIED' AND "isFlaggedForFraud" = false THEN 'VIEWING_REQUEST'::"ListingActionEligibility"
    WHEN "status"::text = 'PENDING' AND "isFlaggedForFraud" = false THEN 'ENQUIRY'::"ListingActionEligibility"
    ELSE 'SOURCE_LINK_ONLY'::"ListingActionEligibility"
  END;
