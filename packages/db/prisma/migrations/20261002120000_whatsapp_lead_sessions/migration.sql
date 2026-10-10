-- WhatsApp leads may message before they have a Lodgist User row.
-- userId/contactId/senderId become optional. Phone is the WhatsApp wa_id.
ALTER TABLE "WhatsAppSession" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "WhatsAppSession" ALTER COLUMN "contactId" DROP NOT NULL;
ALTER TABLE "WhatsAppSession" ADD COLUMN "phone" TEXT;
ALTER TABLE "WhatsAppSession" ADD COLUMN "handoffRequested" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "WhatsAppSession_phone_idx" ON "WhatsAppSession"("phone");

ALTER TABLE "WhatsAppMessage" ALTER COLUMN "senderId" DROP NOT NULL;
