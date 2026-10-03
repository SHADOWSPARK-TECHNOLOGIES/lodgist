-- Demand capture when public browse has no verified match.
-- Does not update Listing.status and does not mark sample rows VERIFIED.

CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "location" TEXT NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "moveInTimeframe" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
