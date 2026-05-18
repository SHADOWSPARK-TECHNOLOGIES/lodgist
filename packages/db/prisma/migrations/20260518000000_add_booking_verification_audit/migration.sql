-- Add verifiedBy and verifiedAt audit fields to Booking
-- verifiedBy references the User who approved/rejected/cancelled the payment
-- verifiedAt records when the verification action was taken

ALTER TABLE "Booking" ADD COLUMN "verifiedBy" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "verifiedAt" TIMESTAMP(3);

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_verifiedBy_fkey"
  FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Booking_verifiedBy_idx" ON "Booking"("verifiedBy");
