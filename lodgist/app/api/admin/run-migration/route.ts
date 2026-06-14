/**
 * One-shot migration runner — apply via: POST /api/admin/run-migration
 * DELETE this file after migration is confirmed applied.
 */
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  if (!process.env.MIGRATION_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = req.headers.get("x-migration-secret");
  if (secret !== process.env.MIGRATION_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingSource') THEN
          CREATE TYPE "ListingSource" AS ENUM ('USER_CREATED', 'SCRAPED_EXTERNAL', 'CLAIMED_FROM_SCRAPE');
        END IF;
      END $$;
    `);

    const addColumns = [
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "address" TEXT`,
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "bedrooms" INTEGER`,
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "bathrooms" INTEGER`,
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "propertyType" TEXT`,
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT`,
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "sourceName" TEXT`,
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "estimatedAgentFee" DOUBLE PRECISION`,
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "isClaimable" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3)`,
    ];

    for (const sql of addColumns) {
      await prisma.$executeRawUnsafe(sql);
    }

    // source column needs the enum type — add separately
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Listing' AND column_name = 'source'
        ) THEN
          ALTER TABLE "Listing" ADD COLUMN "source" "ListingSource" NOT NULL DEFAULT 'USER_CREATED';
        END IF;
      END $$;
    `);

    return Response.json({ ok: true, message: "Migration applied successfully" });
  } catch (e) {
    const error = e as Error;
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
