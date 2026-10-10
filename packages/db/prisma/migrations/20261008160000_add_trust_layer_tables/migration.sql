-- Trust-layer enums and tables already declared in schema.prisma.
-- Additive and idempotent: production may already have these objects from an
-- earlier db push. Re-running must succeed and must not delete or rewrite data.
--
-- Non-additive drift is intentionally not in this file:
--   WhatsAppSession user/contact and WhatsAppMessage sender stay ON DELETE RESTRICT
--   Booking_verifiedBy_idx stays
--   RentalCheck and RentalCheckDraft updatedAt keep their CURRENT_TIMESTAMP default
-- Those were aligned in schema.prisma instead of dropping constraints or defaults.

DO $$ BEGIN
  CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FraudSignalType" AS ENUM ('DUPLICATE_LISTING', 'FAKE_DOCUMENT', 'PRICE_MANIPULATION', 'IDENTITY_MISMATCH', 'SUSPICIOUS_ACTIVITY', 'USER_REPORT', 'AGENT_REPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SignalSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SignalSource" AS ENUM ('SYSTEM', 'USER_REPORT', 'ADMIN_MANUAL', 'AGENT_REPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SignalStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AdminActionType" AS ENUM ('RISK_STATE_OVERRIDE', 'FRAUD_SIGNAL_CREATED', 'FRAUD_SIGNAL_RESOLVED', 'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "VerificationRequest" (
    "id" TEXT NOT NULL,
    "listingId" INTEGER NOT NULL,
    "submittedById" INTEGER NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "documentUrls" TEXT[],
    "notes" TEXT,
    "reviewNote" TEXT,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FraudSignal" (
    "id" TEXT NOT NULL,
    "listingId" INTEGER NOT NULL,
    "signalType" "FraudSignalType" NOT NULL,
    "severity" "SignalSeverity" NOT NULL DEFAULT 'MEDIUM',
    "source" "SignalSource" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" INTEGER,
    "resolvedById" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrustComponent" (
    "id" TEXT NOT NULL,
    "listingId" INTEGER NOT NULL,
    "componentKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL,
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminAction" (
    "id" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "actionType" "AdminActionType" NOT NULL,
    "targetListingId" INTEGER,
    "targetUserId" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VerificationRequest_listingId_idx" ON "VerificationRequest"("listingId");
CREATE INDEX IF NOT EXISTS "VerificationRequest_status_idx" ON "VerificationRequest"("status");
CREATE INDEX IF NOT EXISTS "VerificationRequest_submittedById_idx" ON "VerificationRequest"("submittedById");

CREATE INDEX IF NOT EXISTS "FraudSignal_listingId_idx" ON "FraudSignal"("listingId");
CREATE INDEX IF NOT EXISTS "FraudSignal_status_idx" ON "FraudSignal"("status");
CREATE INDEX IF NOT EXISTS "FraudSignal_severity_idx" ON "FraudSignal"("severity");

CREATE INDEX IF NOT EXISTS "TrustComponent_listingId_idx" ON "TrustComponent"("listingId");
CREATE UNIQUE INDEX IF NOT EXISTS "TrustComponent_listingId_componentKey_key" ON "TrustComponent"("listingId", "componentKey");

CREATE INDEX IF NOT EXISTS "AdminAction_adminId_idx" ON "AdminAction"("adminId");
CREATE INDEX IF NOT EXISTS "AdminAction_targetListingId_idx" ON "AdminAction"("targetListingId");

DO $$ BEGIN
  ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FraudSignal" ADD CONSTRAINT "FraudSignal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FraudSignal" ADD CONSTRAINT "FraudSignal_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FraudSignal" ADD CONSTRAINT "FraudSignal_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TrustComponent" ADD CONSTRAINT "TrustComponent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
