-- Local migration. Do not apply to production until the precheck in
-- docs/WHATSAPP_BOOKING_EXCLUSION.md passes.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "listingId" WITH =,
    tsrange("startDate", "endDate", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'PENDING_VERIFICATION', 'CONFIRMED'));
