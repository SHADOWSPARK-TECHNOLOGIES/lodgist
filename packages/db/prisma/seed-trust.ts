/**
 * Trust layer seed — standalone, safe to run against a live dev database.
 * Does NOT delete any existing data; uses upserts throughout.
 *
 * Run from packages/db/:
 *   npx tsx prisma/seed-trust.ts
 *
 * Requires DATABASE_URL in environment (or packages/db/.env).
 */

import "dotenv/config";
import {
  PrismaClient,
  RiskState,
  ListingCategory,
  ListingStatus,
  Currency,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const TRUST_COMPONENTS = [
  { key: "title_document",       label: "Title Document Verified",     weight: 30 },
  { key: "landlord_identity",    label: "Landlord Identity Confirmed",  weight: 25 },
  { key: "agent_physical_visit", label: "Agent Physical Inspection",    weight: 20 },
  { key: "price_market_check",   label: "Price Market Validated",       weight: 10 },
  { key: "no_active_disputes",   label: "No Active Disputes on Record", weight: 10 },
  { key: "legal_consent",        label: "Legal Consent on File",        weight: 5  },
] as const;

if (process.env.LODGIST_LEGACY_FICTIONAL_SEED !== "1") {
  console.error("Refusing prisma/seed-trust.ts. It invents homes, a verified user, and a trust score. Use: node prisma/seed-owerri-home.js");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function upsertSeedUser(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: "LANDLORD",
      passwordHash: "$2b$12$placeholderHashForSeedOnly",
      isVerified: true,
    },
    update: {},
  });
}

async function seedListingWithTrust(
  ownerId: number,
  listing: {
    title: string;
    description: string;
    price: number;
    riskState: RiskState;
    truthIndex: number;
    componentOverrides: Partial<Record<string, boolean>>;
  },
) {
  const created = await prisma.listing.create({
    data: {
      ownerId,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      currency: Currency.NGN,
      category: ListingCategory.RESIDENTIAL,
      status: ListingStatus.PENDING,
      riskState: listing.riskState,
      truthIndex: listing.truthIndex,
    },
  });

  await Promise.all(
    TRUST_COMPONENTS.map((c) =>
      prisma.trustComponent.upsert({
        where: {
          listingId_componentKey: {
            listingId: created.id,
            componentKey: c.key,
          },
        },
        create: {
          listingId: created.id,
          componentKey: c.key,
          label: c.label,
          weight: c.weight,
          passed: listing.componentOverrides[c.key] ?? false,
          verifiedAt:
            listing.componentOverrides[c.key] ? new Date() : undefined,
        },
        update: {},
      }),
    ),
  );

  return created;
}

async function main() {
  console.log("🌱 Seeding trust layer data...");

  const owner = await upsertSeedUser(
    "trust-seed-owner@lodgist.ng",
    "Trust Seed Owner",
  );
  console.log(`   ✓ Seed user: ${owner.email} (id=${owner.id})`);

  // ── VERIFIED listing — all components passed, truthIndex 92 ───────────────
  const verified = await seedListingWithTrust(owner.id, {
    title: "Fully Verified 3BR Flat — Lekki Phase 1",
    description:
      "A fully verified 3-bedroom flat in Lekki Phase 1 with title document, confirmed landlord identity, and a completed agent inspection.",
    price: 4_500_000,
    riskState: RiskState.VERIFIED,
    truthIndex: 92,
    componentOverrides: {
      title_document: true,
      landlord_identity: true,
      agent_physical_visit: true,
      price_market_check: true,
      no_active_disputes: true,
      legal_consent: false, // weight 5 not passed → 95/100 → rounds to 92 with weight math
    },
  });
  console.log(`   ✓ VERIFIED listing id=${verified.id} truthIndex=92`);

  // ── UNVERIFIED listing — no components passed, truthIndex 0 ───────────────
  const unverified = await seedListingWithTrust(owner.id, {
    title: "Unverified 1BR Studio — Surulere",
    description:
      "A new listing pending verification. No documents submitted yet.",
    price: 800_000,
    riskState: RiskState.UNVERIFIED,
    truthIndex: 0,
    componentOverrides: {},
  });
  console.log(`   ✓ UNVERIFIED listing id=${unverified.id} truthIndex=0`);

  // ── FLAGGED listing — mixed components, truthIndex 35 ─────────────────────
  const flagged = await seedListingWithTrust(owner.id, {
    title: "Flagged 2BR Apartment — Yaba (Under Review)",
    description:
      "This listing has been flagged for suspicious activity. Price is significantly below market rate.",
    price: 250_000,
    riskState: RiskState.FLAGGED,
    truthIndex: 35,
    componentOverrides: {
      title_document: false,
      landlord_identity: true,  // 25 passed
      agent_physical_visit: false,
      price_market_check: true, // 10 passed → 35/100 total weight
      no_active_disputes: false,
      legal_consent: false,
    },
  });
  console.log(`   ✓ FLAGGED listing id=${flagged.id} truthIndex=35`);

  console.log("\n✅ Trust seed complete.");
  console.log(
    `\nSample curl:\n  curl http://localhost:3000/api/listings/${verified.id}/trust`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
