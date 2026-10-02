-- Facts a landlord must submit before staff can review one home.
-- Stored on AdvertiserLead only. Does not insert a Listing, does not set
-- Listing.status, reviewStatus, or verification, and does not publish a home.
-- Existing rows stay null: they do not have this packet yet.
-- New API writes require every column below.

DO $$ BEGIN
  CREATE TYPE "AdvertiserAuthority" AS ENUM ('CONTROLS', 'AUTHORIZED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AdvertiserAvailability" AS ENUM ('AVAILABLE_NOW', 'FROM_DATE', 'NOT_AVAILABLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AdvertiserRentPeriod" AS ENUM ('MONTH', 'YEAR', 'SEMESTER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AdvertiserLead" ADD COLUMN IF NOT EXISTS "authority" "AdvertiserAuthority";
ALTER TABLE "AdvertiserLead" ADD COLUMN IF NOT EXISTS "photoPublicationAllowed" BOOLEAN;
ALTER TABLE "AdvertiserLead" ADD COLUMN IF NOT EXISTS "availability" "AdvertiserAvailability";
ALTER TABLE "AdvertiserLead" ADD COLUMN IF NOT EXISTS "availableFrom" TIMESTAMP(3);
ALTER TABLE "AdvertiserLead" ADD COLUMN IF NOT EXISTS "rentPeriod" "AdvertiserRentPeriod";
ALTER TABLE "AdvertiserLead" ADD COLUMN IF NOT EXISTS "moveInFees" JSONB;
