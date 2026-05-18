-- WhatsApp session: add contactName and platform fields
ALTER TABLE "WhatsAppSession" ADD COLUMN "contactName" TEXT;
ALTER TABLE "WhatsAppSession" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'whatsapp';

-- WhatsApp message: add direction field (INBOUND / OUTBOUND)
ALTER TABLE "WhatsAppMessage" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'INBOUND';

-- PasskeyChallenge: server-side challenge storage for WebAuthn ceremonies.
-- Prevents replay attacks — challenge must match what this server issued.
CREATE TABLE "PasskeyChallenge" (
    "id"        TEXT NOT NULL,
    "userId"    INTEGER,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasskeyChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasskeyChallenge_challenge_key" ON "PasskeyChallenge"("challenge");
CREATE INDEX "PasskeyChallenge_userId_idx"    ON "PasskeyChallenge"("userId");
CREATE INDEX "PasskeyChallenge_challenge_idx" ON "PasskeyChallenge"("challenge");
CREATE INDEX "PasskeyChallenge_expiresAt_idx" ON "PasskeyChallenge"("expiresAt");

ALTER TABLE "PasskeyChallenge" ADD CONSTRAINT "PasskeyChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
