-- Landlord / hostel interest capture for paid presentation + enquiry help.
-- Does NOT create listings, does NOT set Listing.status, does NOT grant verification.

CREATE TABLE "AdvertiserLead" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "propertyCount" INTEGER,
    "notes" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertiserLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvertiserLead_phone_idx" ON "AdvertiserLead"("phone");
CREATE INDEX "AdvertiserLead_createdAt_idx" ON "AdvertiserLead"("createdAt");
