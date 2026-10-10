-- Public GET /api/listings filters riskState IS NULL OR riskState = 'VERIFIED'.
-- The column was added NOT NULL, so the generated client rejected
-- `{ riskState: null }` with PrismaClientValidationError: Argument `riskState` is missing.
-- Relax the constraint. The UNVERIFIED default is unchanged.
ALTER TABLE "Listing" ALTER COLUMN "riskState" DROP NOT NULL;
