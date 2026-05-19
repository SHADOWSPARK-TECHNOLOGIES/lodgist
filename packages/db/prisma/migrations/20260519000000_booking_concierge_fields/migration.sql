-- Add sourceChannel and adminNotes to Booking for manual/concierge beta operations.
-- sourceChannel: tracks lead origin (whatsapp, instagram, chatbot, direct, etc.)
-- adminNotes: internal-only staff notes on payment verification decisions.

ALTER TABLE "Booking" ADD COLUMN "sourceChannel" TEXT;
ALTER TABLE "Booking" ADD COLUMN "adminNotes" TEXT;
