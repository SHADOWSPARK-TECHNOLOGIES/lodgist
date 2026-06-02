-- Migration: add_listing_source_two_tier
-- Adds two-tier listing source system and direct display fields for search

-- 1. Create ListingSource enum
CREATE TYPE "ListingSource" AS ENUM ('USER_CREATED', 'SCRAPED_EXTERNAL', 'CLAIMED_FROM_SCRAPE');

-- 2. Add display fields (denormalized for search / scraped listings without a Property record)
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "bedrooms" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "bathrooms" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "propertyType" TEXT;

-- 3. Add two-tier source fields
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "source" "ListingSource" NOT NULL DEFAULT 'USER_CREATED';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "sourceName" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "estimatedAgentFee" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "isClaimable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
