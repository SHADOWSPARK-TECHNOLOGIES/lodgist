-- Listing.riskState and Listing.truthIndex are in schema.prisma but were never migrated.
-- Prisma selects every scalar on findMany, so GET /api/listings 500s until these exist.

DO $$ BEGIN
  CREATE TYPE "RiskState" AS ENUM ('VERIFIED', 'UNVERIFIED', 'UNDER_REVIEW', 'FLAGGED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "riskState" "RiskState" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "truthIndex" INTEGER;
