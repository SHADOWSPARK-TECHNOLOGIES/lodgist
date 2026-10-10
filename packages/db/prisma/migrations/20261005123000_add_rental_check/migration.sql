-- Rental Safety Check cases. Additive only.
-- A paid row is a review. It does not set Listing.status, reviewStatus, or RiskState.
-- paymentDetails is evidence (bank name / account), not card or OTP storage.
-- Deploy this before the API revision that reads RentalCheck.

DO $$ BEGIN
  CREATE TYPE "RentalCheckStatus" AS ENUM (
    'SUBMITTED',
    'AWAITING_PAYMENT',
    'PAID',
    'UNDER_REVIEW',
    'REPORT_READY',
    'DELIVERED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RentalCheckPaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RentalCheckReviewStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RentalCheckConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RentalCheckRecommendation" AS ENUM ('LOWER_RISK', 'UNCERTAIN', 'HIGH_RISK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RentalCheck" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "userId" INTEGER,
  "customerName" TEXT,
  "customerPhone" TEXT NOT NULL,
  "customerEmail" TEXT,
  "listingUrl" TEXT,
  "location" TEXT NOT NULL,
  "askingRent" INTEGER NOT NULL,
  "agentName" TEXT,
  "agentPhone" TEXT,
  "paymentDetails" JSONB,
  "customerNotes" TEXT,
  "status" "RentalCheckStatus" NOT NULL DEFAULT 'SUBMITTED',
  "paymentStatus" "RentalCheckPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "reviewStatus" "RentalCheckReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "paystackReference" TEXT,
  "amountNgn" INTEGER NOT NULL DEFAULT 5000,
  "paidAt" TIMESTAMP(3),
  "riskScore" INTEGER,
  "confidence" "RentalCheckConfidence",
  "recommendation" "RentalCheckRecommendation",
  "reviewerNotes" TEXT,
  "evidence" JSONB,
  "reviewedBy" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "reportPublishedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RentalCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RentalCheck_publicReference_key" ON "RentalCheck"("publicReference");
CREATE UNIQUE INDEX IF NOT EXISTS "RentalCheck_paystackReference_key" ON "RentalCheck"("paystackReference");
CREATE INDEX IF NOT EXISTS "RentalCheck_customerPhone_idx" ON "RentalCheck"("customerPhone");
CREATE INDEX IF NOT EXISTS "RentalCheck_status_idx" ON "RentalCheck"("status");
CREATE INDEX IF NOT EXISTS "RentalCheck_paymentStatus_idx" ON "RentalCheck"("paymentStatus");
CREATE INDEX IF NOT EXISTS "RentalCheck_createdAt_idx" ON "RentalCheck"("createdAt");

DO $$ BEGIN
  ALTER TABLE "RentalCheck"
    ADD CONSTRAINT "RentalCheck_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RentalCheck"
    ADD CONSTRAINT "RentalCheck_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RentalCheckDraft" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "fields" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RentalCheckDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RentalCheckDraft_phone_key" ON "RentalCheckDraft"("phone");
