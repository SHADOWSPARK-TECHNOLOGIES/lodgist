-- Rental Safety Check cases. Payment confirms the fee only.
-- Does not insert a Listing, does not set Listing.status, reviewStatus,
-- or verification, and does not publish a home.
-- paymentDetails may hold bank-account evidence. Do not store card, CVV, PIN, or OTP.

DO $$ BEGIN
  CREATE TYPE "RentalCheckStatus" AS ENUM (
    'SUBMITTED', 'AWAITING_PAYMENT', 'PAID', 'UNDER_REVIEW', 'REPORT_READY', 'DELIVERED', 'CANCELLED'
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
    "accessToken" TEXT NOT NULL,
    "userId" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "listingUrl" TEXT,
    "location" TEXT NOT NULL,
    "askingRent" INTEGER NOT NULL,
    "agentName" TEXT,
    "agentPhone" TEXT,
    "paymentDetails" JSONB,
    "customerNotes" TEXT,
    "evidence" JSONB,
    "neighborhoodContext" JSONB,
    "status" "RentalCheckStatus" NOT NULL DEFAULT 'SUBMITTED',
    "paymentStatus" "RentalCheckPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "reviewStatus" "RentalCheckReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "paystackReference" TEXT,
    "paystackAuthorizationUrl" TEXT,
    "amountKobo" INTEGER NOT NULL DEFAULT 500000,
    "paidAt" TIMESTAMP(3),
    "riskScore" INTEGER,
    "confidence" "RentalCheckConfidence",
    "recommendation" "RentalCheckRecommendation",
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RentalCheck_publicReference_key" ON "RentalCheck"("publicReference");
CREATE UNIQUE INDEX IF NOT EXISTS "RentalCheck_accessToken_key" ON "RentalCheck"("accessToken");
CREATE UNIQUE INDEX IF NOT EXISTS "RentalCheck_paystackReference_key" ON "RentalCheck"("paystackReference");
CREATE INDEX IF NOT EXISTS "RentalCheck_customerPhone_idx" ON "RentalCheck"("customerPhone");
CREATE INDEX IF NOT EXISTS "RentalCheck_status_idx" ON "RentalCheck"("status");
CREATE INDEX IF NOT EXISTS "RentalCheck_paymentStatus_idx" ON "RentalCheck"("paymentStatus");
CREATE INDEX IF NOT EXISTS "RentalCheck_createdAt_idx" ON "RentalCheck"("createdAt");
CREATE INDEX IF NOT EXISTS "RentalCheck_userId_idx" ON "RentalCheck"("userId");

DO $$ BEGIN
  ALTER TABLE "RentalCheck"
    ADD CONSTRAINT "RentalCheck_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "WhatsAppSession" ADD COLUMN IF NOT EXISTS "context" JSONB;
