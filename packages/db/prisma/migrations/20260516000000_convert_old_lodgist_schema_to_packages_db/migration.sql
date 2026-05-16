-- ────────────────────────────────────────────────────────────────────────────
-- Migration: Convert old lodgist schema to packages/db schema
-- 
-- The old schema (applied by lodgist/prisma/schema.prisma via prisma db push):
--   - String/cuid IDs on all tables
--   - RoleName enum + Role TABLE (not a Postgres enum)
--   - User: password (not passwordHash), image (not avatarUrl), roleId (FK to Role)
--   - Property: zip, truthIndex
--   - Listing: agentId, status as String
--   - ListingImage: alt (not altText)
--   - Booking: status as String, no totalAmount
--   - TruthIndexScore: propertyId (not userId), score Int (not Float)
--   - Account/Session: userId as String
--   - No: Profile, ViewingRequest, EscrowTransaction, FraudReport, AIFraudSignal,
--        WhatsAppSession, WhatsAppMessage, Referral, PasskeyCredential, Notification
--
-- The new schema (packages/db/prisma/schema.prisma):
--   - Int/serial IDs
--   - Role as Postgres ENUM
--   - User: passwordHash, avatarUrl, role as enum, truthIndex, isVerified, 
--        isHNW, hnwVerifiedAt, phone, whatsappId
--   - Property: NO zip, NO truthIndex, ownerId Int
--   - Listing: ownerId, propertyId Int?, status as ListingStatus enum
--   - Booking: totalAmount, status as BookingStatus enum
--   - TruthIndexScore: userId, score Float
--   - Account/Session/VerificationToken: userId as Int
-- ────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 0: Helper functions
-- ════════════════════════════════════════════════════════════════════════════

-- Create a function to map old Role table entries to new Role enum values
CREATE OR REPLACE FUNCTION lodgist_migrate_role_name(old_name text)
RETURNS text
LANGUAGE SQL IMMUTABLE
AS $$
  SELECT CASE old_name
    WHEN 'ADMIN' THEN 'STUDIO_ADMIN'
    WHEN 'AGENT' THEN 'AGENT'
    WHEN 'LANDLORD' THEN 'LANDLORD'
    WHEN 'TENANT' THEN 'TENANT'
    ELSE 'USER'
  END
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Create new enums
-- ════════════════════════════════════════════════════════════════════════════

-- Create new Role enum (the old schema uses a RoleName enum + Role table)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('USER', 'ARTISAN', 'LANDLORD', 'STUDIO_ADMIN', 'TENANT', 'AGENT');
  END IF;
END $$;

-- Create ListingStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingStatus') THEN
    CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'ARCHIVED');
  END IF;
END $$;

-- Create BookingStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN
    CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
  END IF;
END $$;

-- Create ListingCategory enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingCategory') THEN
    CREATE TYPE "ListingCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'SHORT_LET');
  END IF;
END $$;

-- Create ViewingStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ViewingStatus') THEN
    CREATE TYPE "ViewingStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
  END IF;
END $$;

-- Create EscrowStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowStatus') THEN
    CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'DISPUTED');
  END IF;
END $$;

-- Create NotificationType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM (
      'BOOKING_CONFIRMATION', 'VIEWING_REMINDER', 'PAYMENT_RECEIPT',
      'FRAUD_ALERT', 'TRUTH_SCORE_UPDATE', 'MESSAGE_RECEIVED', 'ESCROW_UPDATE'
    );
  END IF;
END $$;

-- Create Currency enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Currency') THEN
    CREATE TYPE "Currency" AS ENUM ('NGN', 'USD', 'GBP', 'EUR');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Migrate User table
-- ════════════════════════════════════════════════════════════════════════════

-- Step 2a: Add new columns to User (safe via DO blocks)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'passwordHash') THEN
    ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
    -- Migrate password data
    UPDATE "User" SET "passwordHash" = "password" WHERE "password" IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'avatarUrl') THEN
    ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
    -- Migrate image data
    UPDATE "User" SET "avatarUrl" = "image" WHERE "image" IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'role') THEN
    ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'truthIndex') THEN
    ALTER TABLE "User" ADD COLUMN "truthIndex" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'isVerified') THEN
    ALTER TABLE "User" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'phone') THEN
    ALTER TABLE "User" ADD COLUMN "phone" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'whatsappId') THEN
    ALTER TABLE "User" ADD COLUMN "whatsappId" TEXT;
  END IF;
END $$;

-- Step 2b: Migrate role data from old Role table to new role enum column
DO $$
DECLARE
  user_rec RECORD;
  role_name_text TEXT;
BEGIN
  FOR user_rec IN SELECT u.id, u."roleId" FROM "User" u WHERE u."roleId" IS NOT NULL LOOP
    SELECT r.name::text INTO role_name_text FROM "Role" r WHERE r.id = user_rec."roleId";
    IF role_name_text IS NOT NULL THEN
      UPDATE "User" SET "role" = lodgist_migrate_role_name(role_name_text)::"Role"
      WHERE id = user_rec.id;
    END IF;
  END LOOP;
END $$;

-- Step 2c: Drop old columns from User (only after data migration is complete)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'password') THEN
    ALTER TABLE "User" DROP COLUMN "password";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'image') THEN
    ALTER TABLE "User" DROP COLUMN "image";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'roleId') THEN
    ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_roleId_fkey";
    ALTER TABLE "User" DROP COLUMN "roleId";
  END IF;
END $$;

-- Make name NOT NULL (old schema had String?)
-- First ensure no null names
UPDATE "User" SET name = COALESCE(name, email) WHERE name IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'name' AND is_nullable = 'YES') THEN
    ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Drop old Role table and RoleName enum
-- ════════════════════════════════════════════════════════════════════════════

-- Drop old Role table (foreign key already removed from User)
DROP TABLE IF EXISTS "Role" CASCADE;

-- Drop old RoleName enum (safe after Role table is dropped)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoleName') THEN
    DROP TYPE "RoleName";
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 4: Migrate Property table
-- ════════════════════════════════════════════════════════════════════════════

-- Add/Modify columns on Property
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'lga') THEN
    ALTER TABLE "Property" ADD COLUMN "lga" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'landmark') THEN
    ALTER TABLE "Property" ADD COLUMN "landmark" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'latitude') THEN
    ALTER TABLE "Property" ADD COLUMN "latitude" DOUBLE PRECISION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'longitude') THEN
    ALTER TABLE "Property" ADD COLUMN "longitude" DOUBLE PRECISION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'propertyType') THEN
    ALTER TABLE "Property" ADD COLUMN "propertyType" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'bedrooms') THEN
    ALTER TABLE "Property" ADD COLUMN "bedrooms" INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'bathrooms') THEN
    ALTER TABLE "Property" ADD COLUMN "bathrooms" INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'size') THEN
    ALTER TABLE "Property" ADD COLUMN "size" DOUBLE PRECISION;
  END IF;
END $$;

-- Drop old columns from Property
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'zip') THEN
    ALTER TABLE "Property" DROP COLUMN "zip";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Property' AND column_name = 'truthIndex') THEN
    ALTER TABLE "Property" DROP COLUMN "truthIndex";
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 5: Migrate Listing table
-- ════════════════════════════════════════════════════════════════════════════

-- Add new columns to Listing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'ownerId') THEN
    ALTER TABLE "Listing" ADD COLUMN "ownerId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'title') THEN
    ALTER TABLE "Listing" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Property Listing';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'currency') THEN
    ALTER TABLE "Listing" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'NGN';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'category') THEN
    ALTER TABLE "Listing" ADD COLUMN "category" "ListingCategory" NOT NULL DEFAULT 'RESIDENTIAL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'isFeatured') THEN
    ALTER TABLE "Listing" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'views') THEN
    ALTER TABLE "Listing" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'totalMoveInCost') THEN
    ALTER TABLE "Listing" ADD COLUMN "totalMoveInCost" JSONB;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'availableFrom') THEN
    ALTER TABLE "Listing" ADD COLUMN "availableFrom" TIMESTAMP(3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'furnished') THEN
    ALTER TABLE "Listing" ADD COLUMN "furnished" BOOLEAN;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'serviceCharge') THEN
    ALTER TABLE "Listing" ADD COLUMN "serviceCharge" DOUBLE PRECISION;
  END IF;
END $$;

-- Migrate ownerId from agentId (old schema agent = user who created the listing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'agentId') THEN
    UPDATE "Listing" SET "ownerId" = "agentId" WHERE "ownerId" IS NULL;
  END IF;
END $$;

-- Convert status from string to enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Listing' AND column_name = 'status' AND data_type = 'text') THEN
    -- Create a temporary column with the enum type
    ALTER TABLE "Listing" ADD COLUMN "status_new" "ListingStatus" NOT NULL DEFAULT 'PENDING';
    -- Map old string values to enum
    UPDATE "Listing" SET "status_new" = CASE
      WHEN "status" IN ('available', 'active') THEN 'VERIFIED'::"ListingStatus"
      WHEN "status" = 'pending' THEN 'PENDING'::"ListingStatus"
      WHEN "status" = 'rejected' THEN 'REJECTED'::"ListingStatus"
      WHEN "status" = 'archived' THEN 'ARCHIVED'::"ListingStatus"
      ELSE 'PENDING'::"ListingStatus"
    END;
    -- Drop old column and rename new one
    ALTER TABLE "Listing" DROP COLUMN "status";
    ALTER TABLE "Listing" RENAME COLUMN "status_new" TO "status";
  END IF;
END $$;

-- Drop agentId from Listing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Listing' AND column_name = 'agentId') THEN
    ALTER TABLE "Listing" DROP CONSTRAINT IF EXISTS "Listing_agentId_fkey";
    ALTER TABLE "Listing" DROP COLUMN "agentId";
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 6: Migrate ListingImage table
-- ════════════════════════════════════════════════════════════════════════════

-- Rename alt to altText
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ListingImage' AND column_name = 'alt') THEN
    ALTER TABLE "ListingImage" RENAME COLUMN "alt" TO "altText";
  END IF;
END $$;

-- Add new columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ListingImage' AND column_name = 'isPrimary') THEN
    ALTER TABLE "ListingImage" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ListingImage' AND column_name = 'order') THEN
    ALTER TABLE "ListingImage" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 7: Migrate Booking table
-- ════════════════════════════════════════════════════════════════════════════

-- Add new columns to Booking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Booking' AND column_name = 'totalAmount') THEN
    ALTER TABLE "Booking" ADD COLUMN "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Booking' AND column_name = 'currency') THEN
    ALTER TABLE "Booking" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'NGN';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Booking' AND column_name = 'notes') THEN
    ALTER TABLE "Booking" ADD COLUMN "notes" TEXT;
  END IF;
END $$;

-- Convert booking status from string to enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Booking' AND column_name = 'status' AND data_type = 'text') THEN
    ALTER TABLE "Booking" ADD COLUMN "status_new" "BookingStatus" NOT NULL DEFAULT 'PENDING';
    UPDATE "Booking" SET "status_new" = CASE
      WHEN LOWER("status") = 'pending' THEN 'PENDING'::"BookingStatus"
      WHEN LOWER("status") = 'confirmed' THEN 'CONFIRMED'::"BookingStatus"
      WHEN LOWER("status") = 'cancelled' THEN 'CANCELLED'::"BookingStatus"
      WHEN LOWER("status") = 'completed' THEN 'COMPLETED'::"BookingStatus"
      ELSE 'PENDING'::"BookingStatus"
    END;
    ALTER TABLE "Booking" DROP COLUMN "status";
    ALTER TABLE "Booking" RENAME COLUMN "status_new" TO "status";
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 8: Migrate TruthIndexScore table
-- ════════════════════════════════════════════════════════════════════════════

-- Add userId column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TruthIndexScore' AND column_name = 'userId') THEN
    ALTER TABLE "TruthIndexScore" ADD COLUMN "userId" TEXT;
    -- Attempt to populate userId from Property ownership
    -- (old schema: TruthIndexScore.propertyId → Property.ownerId → User)
    UPDATE "TruthIndexScore" tis
    SET "userId" = p."ownerId"
    FROM "Property" p
    WHERE p.id = tis."propertyId";
  END IF;
END $$;

-- Add new score columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TruthIndexScore' AND column_name = 'activityScore') THEN
    ALTER TABLE "TruthIndexScore" ADD COLUMN "activityScore" DOUBLE PRECISION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TruthIndexScore' AND column_name = 'verificationScore') THEN
    ALTER TABLE "TruthIndexScore" ADD COLUMN "verificationScore" DOUBLE PRECISION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TruthIndexScore' AND column_name = 'ratingScore') THEN
    ALTER TABLE "TruthIndexScore" ADD COLUMN "ratingScore" DOUBLE PRECISION;
  END IF;
END $$;

-- Drop old propertyId column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TruthIndexScore' AND column_name = 'propertyId') THEN
    ALTER TABLE "TruthIndexScore" DROP COLUMN "propertyId";
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 9: Create new tables (ones that don't exist in old schema)
-- ════════════════════════════════════════════════════════════════════════════

-- Profile
CREATE TABLE IF NOT EXISTS "Profile" (
    id SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    bio TEXT,
    state TEXT,
    lga TEXT,
    address TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "idVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY (id)
);

-- ViewingRequest
CREATE TABLE IF NOT EXISTS "ViewingRequest" (
    id SERIAL NOT NULL,
    "listingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "preferredTime" TEXT,
    status "ViewingStatus" NOT NULL DEFAULT 'REQUESTED',
    notes TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewingRequest_pkey" PRIMARY KEY (id)
);

-- EscrowTransaction
CREATE TABLE IF NOT EXISTS "EscrowTransaction" (
    id TEXT NOT NULL,
    reference TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "listingId" TEXT,
    amount DOUBLE PRECISION NOT NULL,
    currency "Currency" NOT NULL DEFAULT 'NGN',
    status "EscrowStatus" NOT NULL DEFAULT 'HELD',
    description TEXT,
    "releaseDate" TIMESTAMP(3),
    "paystackAuthorizationUrl" TEXT,
    "paystackReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY (id)
);

-- FraudReport
CREATE TABLE IF NOT EXISTS "FraudReport" (
    id SERIAL NOT NULL,
    "listingId" TEXT,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB,
    status TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FraudReport_pkey" PRIMARY KEY (id)
);

-- AIFraudSignal
CREATE TABLE IF NOT EXISTS "AIFraudSignal" (
    id SERIAL NOT NULL,
    "listingId" TEXT NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    reasoning TEXT NOT NULL,
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFraudSignal_pkey" PRIMARY KEY (id)
);

-- WhatsAppSession
CREATE TABLE IF NOT EXISTS "WhatsAppSession" (
    id TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "listingId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY (id)
);

-- WhatsAppMessage
CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
    id SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    content TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'TEXT',
    metadata JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY (id)
);

-- Referral
CREATE TABLE IF NOT EXISTS "Referral" (
    id SERIAL NOT NULL,
    "referrerId" TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY (id)
);

-- PasskeyCredential
CREATE TABLE IF NOT EXISTS "PasskeyCredential" (
    id SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "deviceType" TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Passkey',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY (id)
);

-- Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    id SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    type "NotificationType" NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY (id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 10: Create indexes
-- ════════════════════════════════════════════════════════════════════════════

-- User indexes
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_whatsappId_idx" ON "User"("whatsappId");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- Profile indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_userId_key" ON "Profile"("userId");
CREATE INDEX IF NOT EXISTS "Profile_state_lga_idx" ON "Profile"("state", "lga");

-- Property indexes
CREATE INDEX IF NOT EXISTS "Property_state_lga_idx" ON "Property"("state", "lga");
CREATE INDEX IF NOT EXISTS "Property_ownerId_idx" ON "Property"("ownerId");

-- Listing indexes
CREATE INDEX IF NOT EXISTS "Listing_ownerId_idx" ON "Listing"("ownerId");
CREATE INDEX IF NOT EXISTS "Listing_category_idx" ON "Listing"("category");
CREATE INDEX IF NOT EXISTS "Listing_status_idx" ON "Listing"("status");

-- ListingImage indexes
CREATE INDEX IF NOT EXISTS "ListingImage_listingId_idx" ON "ListingImage"("listingId");

-- Booking indexes
CREATE INDEX IF NOT EXISTS "Booking_tenantId_idx" ON "Booking"("tenantId");
CREATE INDEX IF NOT EXISTS "Booking_listingId_idx" ON "Booking"("listingId");
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");

-- ViewingRequest indexes
CREATE INDEX IF NOT EXISTS "ViewingRequest_listingId_idx" ON "ViewingRequest"("listingId");
CREATE INDEX IF NOT EXISTS "ViewingRequest_requesterId_idx" ON "ViewingRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "ViewingRequest_status_idx" ON "ViewingRequest"("status");

-- EscrowTransaction indexes
CREATE UNIQUE INDEX IF NOT EXISTS "EscrowTransaction_reference_key" ON "EscrowTransaction"("reference");
CREATE INDEX IF NOT EXISTS "EscrowTransaction_tenantId_idx" ON "EscrowTransaction"("tenantId");
CREATE INDEX IF NOT EXISTS "EscrowTransaction_landlordId_idx" ON "EscrowTransaction"("landlordId");
CREATE INDEX IF NOT EXISTS "EscrowTransaction_status_idx" ON "EscrowTransaction"("status");

-- FraudReport indexes
CREATE INDEX IF NOT EXISTS "FraudReport_reporterId_idx" ON "FraudReport"("reporterId");
CREATE INDEX IF NOT EXISTS "FraudReport_reportedId_idx" ON "FraudReport"("reportedId");
CREATE INDEX IF NOT EXISTS "FraudReport_status_idx" ON "FraudReport"("status");

-- AIFraudSignal indexes
CREATE INDEX IF NOT EXISTS "AIFraudSignal_listingId_idx" ON "AIFraudSignal"("listingId");
CREATE INDEX IF NOT EXISTS "AIFraudSignal_score_idx" ON "AIFraudSignal"("score");

-- TruthIndexScore indexes
CREATE INDEX IF NOT EXISTS "TruthIndexScore_userId_idx" ON "TruthIndexScore"("userId");
CREATE INDEX IF NOT EXISTS "TruthIndexScore_createdAt_idx" ON "TruthIndexScore"("createdAt");

-- WhatsAppSession indexes
CREATE INDEX IF NOT EXISTS "WhatsAppSession_userId_idx" ON "WhatsAppSession"("userId");
CREATE INDEX IF NOT EXISTS "WhatsAppSession_contactId_idx" ON "WhatsAppSession"("contactId");
CREATE INDEX IF NOT EXISTS "WhatsAppSession_listingId_idx" ON "WhatsAppSession"("listingId");

-- WhatsAppMessage indexes
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_sessionId_idx" ON "WhatsAppMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_senderId_idx" ON "WhatsAppMessage"("senderId");

-- Referral indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_referrerId_key" ON "Referral"("referrerId");
CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx" ON "Referral"("referrerId");

-- PasskeyCredential indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");
CREATE INDEX IF NOT EXISTS "PasskeyCredential_userId_idx" ON "PasskeyCredential"("userId");
CREATE INDEX IF NOT EXISTS "PasskeyCredential_credentialId_idx" ON "PasskeyCredential"("credentialId");

-- Notification indexes
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 11: Add foreign key constraints
-- ════════════════════════════════════════════════════════════════════════════

-- Profile FK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Profile_userId_fkey' AND table_name = 'Profile') THEN
    ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Property FK (might already exist from old schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Property_ownerId_fkey' AND table_name = 'Property') THEN
    ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ViewingRequest FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ViewingRequest_listingId_fkey' AND table_name = 'ViewingRequest') THEN
    ALTER TABLE "ViewingRequest" ADD CONSTRAINT "ViewingRequest_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ViewingRequest_requesterId_fkey' AND table_name = 'ViewingRequest') THEN
    ALTER TABLE "ViewingRequest" ADD CONSTRAINT "ViewingRequest_requesterId_fkey"
      FOREIGN KEY ("requesterId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- EscrowTransaction FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EscrowTransaction_tenantId_fkey' AND table_name = 'EscrowTransaction') THEN
    ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EscrowTransaction_landlordId_fkey' AND table_name = 'EscrowTransaction') THEN
    ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_landlordId_fkey"
      FOREIGN KEY ("landlordId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EscrowTransaction_listingId_fkey' AND table_name = 'EscrowTransaction') THEN
    ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- FraudReport FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FraudReport_listingId_fkey' AND table_name = 'FraudReport') THEN
    ALTER TABLE "FraudReport" ADD CONSTRAINT "FraudReport_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FraudReport_reporterId_fkey' AND table_name = 'FraudReport') THEN
    ALTER TABLE "FraudReport" ADD CONSTRAINT "FraudReport_reporterId_fkey"
      FOREIGN KEY ("reporterId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FraudReport_reportedId_fkey' AND table_name = 'FraudReport') THEN
    ALTER TABLE "FraudReport" ADD CONSTRAINT "FraudReport_reportedId_fkey"
      FOREIGN KEY ("reportedId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AIFraudSignal FK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AIFraudSignal_listingId_fkey' AND table_name = 'AIFraudSignal') THEN
    ALTER TABLE "AIFraudSignal" ADD CONSTRAINT "AIFraudSignal_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- WhatsAppSession FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WhatsAppSession_userId_fkey' AND table_name = 'WhatsAppSession') THEN
    ALTER TABLE "WhatsAppSession" ADD CONSTRAINT "WhatsAppSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WhatsAppSession_contactId_fkey' AND table_name = 'WhatsAppSession') THEN
    ALTER TABLE "WhatsAppSession" ADD CONSTRAINT "WhatsAppSession_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WhatsAppSession_listingId_fkey' AND table_name = 'WhatsAppSession') THEN
    ALTER TABLE "WhatsAppSession" ADD CONSTRAINT "WhatsAppSession_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- WhatsAppMessage FKs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WhatsAppMessage_sessionId_fkey' AND table_name = 'WhatsAppMessage') THEN
    ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WhatsAppMessage_senderId_fkey' AND table_name = 'WhatsAppMessage') THEN
    ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- PasskeyCredential FK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PasskeyCredential_userId_fkey' AND table_name = 'PasskeyCredential') THEN
    ALTER TABLE "PasskeyCredential" ADD CONSTRAINT "PasskeyCredential_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Notification FK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Notification_userId_fkey' AND table_name = 'Notification') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 12: Update Review table — remove @@unique constraint if exists
-- (old schema had @@unique([listingId, userId]), new schema does not)
-- ════════════════════════════════════════════════════════════════════════════

-- The unique constraint on (listingId, userId) might prevent multiple reviews.
-- If it exists and you want to allow multiple reviews, drop it.
-- Uncomment the following line if needed:
-- ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_listingId_userId_key";

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 13: Cleanup — drop helper function
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS lodgist_migrate_role_name;

-- ════════════════════════════════════════════════════════════════════════════
-- Migration complete!
-- 
-- ⚠️ IMPORTANT NEXT STEPS:
-- 1. After running this SQL, update the Prisma migration history:
--    npx prisma migrate resolve --applied "20260516000000_convert_old_lodgist_schema_to_packages_db"
-- 2. Then run: npx prisma generate
-- 3. Run the seed: npx prisma db seed
-- ────────────────────────────────────────────────────────────────────────────
