/**
 * seed-full.ts — comprehensive demo seed for Lodgist.
 *
 * Creates: Users → Properties → Listings → TrustComponents → ListingImages
 *
 * Safe to re-run: deletes seeded data first (by email prefix "seed-"),
 * preserving any real user accounts created via the app.
 *
 * Run from packages/db/:
 *   npx tsx prisma/seed-full.ts
 */

import "dotenv/config";
import {
  PrismaClient,
  RiskState,
  ListingCategory,
  ListingStatus,
  Currency,
  Role,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hash } from "bcryptjs";

// Use direct URL for seeding (pooler times out on long transactions)
const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── Trust component definitions ──────────────────────────────────────────────

const TRUST_COMPONENTS = [
  { key: "title_document",       label: "Title Document Verified",     weight: 30 },
  { key: "landlord_identity",    label: "Landlord Identity Confirmed",  weight: 25 },
  { key: "agent_physical_visit", label: "Agent Physical Inspection",    weight: 20 },
  { key: "price_market_check",   label: "Price Market Validated",       weight: 10 },
  { key: "no_active_disputes",   label: "No Active Disputes on Record", weight: 10 },
  { key: "legal_consent",        label: "Legal Consent on File",        weight: 5  },
] as const;

type ComponentKey = typeof TRUST_COMPONENTS[number]["key"];

function computeTruthIndex(passed: Partial<Record<ComponentKey, boolean>>): number {
  return TRUST_COMPONENTS.reduce((sum, c) => sum + (passed[c.key] ? c.weight : 0), 0);
}

// ── Placeholder property images (Unsplash free) ───────────────────────────────

const IMAGES = {
  apartment: [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
  ],
  house: [
    "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
  ],
  commercial: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  ],
  student: [
    "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
  ],
};

// ── Seed users ────────────────────────────────────────────────────────────────

async function upsertUser(data: {
  email: string; name: string; role: Role; phone: string;
}) {
  const pw = await hash("Seed2026!", 10);
  return prisma.user.upsert({
    where: { email: data.email },
    create: { ...data, passwordHash: pw, isVerified: true },
    update: {},
    select: { id: true, email: true },
  });
}

// ── Seed a listing with property + trust components ───────────────────────────

async function seedListing(opts: {
  ownerId: number;
  property: {
    address: string; city: string; state: string; lga: string;
    propertyType: string; bedrooms?: number; bathrooms?: number;
  };
  listing: {
    title: string; description: string; price: number;
    category: ListingCategory;
    riskState: RiskState;
    isFeatured?: boolean;
    isStudentLodge?: boolean;
    nearbySchool?: string;
    distanceToSchool?: string;
    studentAmenities?: string[];
  };
  passedComponents: Partial<Record<ComponentKey, boolean>>;
  images?: string[];
  imageType?: keyof typeof IMAGES;
}) {
  const truthIndex = computeTruthIndex(opts.passedComponents);

  const property = await prisma.property.create({
    data: {
      ownerId: opts.ownerId,
      ...opts.property,
    },
    select: { id: true },
  });

  const listing = await prisma.listing.create({
    data: {
      ownerId: opts.ownerId,
      propertyId: property.id,
      title: opts.listing.title,
      description: opts.listing.description,
      price: opts.listing.price,
      currency: Currency.NGN,
      category: opts.listing.category,
      status: ListingStatus.PENDING,
      riskState: opts.listing.riskState,
      truthIndex,
      isFeatured: opts.listing.isFeatured ?? false,
      isStudentLodge: opts.listing.isStudentLodge ?? false,
      nearbySchool: opts.listing.nearbySchool,
      distanceToSchool: opts.listing.distanceToSchool,
      studentAmenities: opts.listing.studentAmenities ?? [],
    },
    select: { id: true },
  });

  // Trust components
  await Promise.all(
    TRUST_COMPONENTS.map((c) =>
      prisma.trustComponent.create({
        data: {
          listingId: listing.id,
          componentKey: c.key,
          label: c.label,
          weight: c.weight,
          passed: opts.passedComponents[c.key] ?? false,
          verifiedAt: opts.passedComponents[c.key] ? new Date() : undefined,
        },
      }),
    ),
  );

  // Images
  const urls = opts.images ?? IMAGES[opts.imageType ?? "apartment"];
  await Promise.all(
    urls.map((url, i) =>
      prisma.listingImage.create({
        data: { listingId: listing.id, url, isPrimary: i === 0, order: i },
      }),
    ),
  );

  return { propertyId: property.id, listingId: listing.id, truthIndex };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Lodgist full seed starting…\n");

  // ── 1. Clean seed data (listings owned by seed users only) ─────────────────
  // Find seed user IDs first, then delete their data
  const seedEmails = [
    "seed-admin@lodgist.ng",
    "seed-emeka@lodgist.ng",
    "seed-aisha@lodgist.ng",
    "seed-bola@lodgist.ng",
    "seed-chukwudi@lodgist.ng",
    "seed-trust@lodgist.ng",
  ];

  const seedUsers = await prisma.user.findMany({
    where: { email: { in: seedEmails } },
    select: { id: true },
  });
  const seedIds = seedUsers.map((u) => u.id);

  if (seedIds.length > 0) {
    // Delete in FK order
    const listingIds = (await prisma.listing.findMany({
      where: { ownerId: { in: seedIds } },
      select: { id: true },
    })).map((l) => l.id);

    if (listingIds.length > 0) {
      await prisma.trustComponent.deleteMany({ where: { listingId: { in: listingIds } } });
      await prisma.listingImage.deleteMany({ where: { listingId: { in: listingIds } } });
      await prisma.verificationRequest.deleteMany({ where: { listingId: { in: listingIds } } });
    }

    const propIds = (await prisma.property.findMany({
      where: { ownerId: { in: seedIds } },
      select: { id: true },
    })).map((p) => p.id);

    await prisma.listing.deleteMany({ where: { ownerId: { in: seedIds } } });
    if (propIds.length > 0) {
      await prisma.property.deleteMany({ where: { id: { in: propIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: seedIds } } });
    console.log(`   Cleaned ${seedIds.length} seed users and their data.\n`);
  }

  // ── 2. Create seed users ────────────────────────────────────────────────────
  const [admin, emeka, aisha, bola, chukwudi, trust] = await Promise.all([
    upsertUser({ email: "seed-admin@lodgist.ng",    name: "Lodgist Admin",      role: Role.STUDIO_ADMIN, phone: "+2348000000001" }),
    upsertUser({ email: "seed-emeka@lodgist.ng",    name: "Emeka Okafor",       role: Role.LANDLORD,     phone: "+2348012345678" }),
    upsertUser({ email: "seed-aisha@lodgist.ng",    name: "Aisha Mohammed",     role: Role.LANDLORD,     phone: "+2348023456789" }),
    upsertUser({ email: "seed-bola@lodgist.ng",     name: "Bola Adeyemi",       role: Role.LANDLORD,     phone: "+2348034567890" }),
    upsertUser({ email: "seed-chukwudi@lodgist.ng", name: "Chukwudi Obi",       role: Role.LANDLORD,     phone: "+2348045678901" }),
    upsertUser({ email: "seed-trust@lodgist.ng",    name: "Chidinma Eze",       role: Role.LANDLORD,     phone: "+2348056789012" }),
  ]);
  console.log("   ✓ Users:", [admin, emeka, aisha, bola, chukwudi, trust].map((u) => u.email).join(", "));

  // ── 3. General listings ─────────────────────────────────────────────────────
  console.log("\n── General Listings ──────────────────────────────────────────");

  const l1 = await seedListing({
    ownerId: emeka.id,
    property: { address: "Banana Island Estate", city: "Lagos", state: "Lagos", lga: "Eti-Osa", propertyType: "Apartment", bedrooms: 3, bathrooms: 3 },
    listing: {
      title: "Luxury 3-Bedroom Apartment + BQ, Pool, Gym & Tennis Court",
      description: "Premium fully-serviced apartment on Banana Island with private pool, gymnasium, and tennis court. Excellent security and 24-hour concierge.",
      price: 40_000_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isFeatured: true,
    },
    passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: true, no_active_disputes: true, legal_consent: true },
    imageType: "apartment",
  });
  console.log(`   ✓ [${l1.listingId}] Banana Island Apt — VERIFIED truthIndex=${l1.truthIndex}`);

  const l2 = await seedListing({
    ownerId: chukwudi.id,
    property: { address: "Bourdillon Road, Ikoyi", city: "Lagos", state: "Lagos", lga: "Eti-Osa", propertyType: "House", bedrooms: 4, bathrooms: 5 },
    listing: {
      title: "Four Bedroom Terrace Duplex + 2-Room BQ, Ikoyi",
      description: "Spacious terrace duplex on Bourdillon Road, Ikoyi. Includes 2-room BQ, CCTV coverage, backup generator, and covered parking for 3 cars.",
      price: 75_000_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isFeatured: true,
    },
    passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: true, no_active_disputes: true, legal_consent: false },
    imageType: "house",
  });
  console.log(`   ✓ [${l2.listingId}] Ikoyi Duplex — VERIFIED truthIndex=${l2.truthIndex}`);

  const l3 = await seedListing({
    ownerId: aisha.id,
    property: { address: "Wuye District", city: "Abuja", state: "FCT", lga: "Abuja Municipal", propertyType: "Apartment", bedrooms: 2, bathrooms: 3 },
    listing: {
      title: "Exquisite 2-Bedroom Apartment with Gym & Pool, Wuye",
      description: "Modern serviced apartment in the heart of Wuye, Abuja. Fully equipped gym, rooftop pool, backup power, and 24/7 security.",
      price: 20_000_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isFeatured: true,
    },
    passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: true, no_active_disputes: false, legal_consent: false },
    imageType: "apartment",
  });
  console.log(`   ✓ [${l3.listingId}] Wuye Abuja Apt — VERIFIED truthIndex=${l3.truthIndex}`);

  const l4 = await seedListing({
    ownerId: bola.id,
    property: { address: "Rev. Ogunbiyi Street, Ikeja GRA", city: "Lagos", state: "Lagos", lga: "Ikeja", propertyType: "House", bedrooms: 4, bathrooms: 4 },
    listing: {
      title: "4-Bedroom Detached House with Garden, Ikeja GRA",
      description: "Detached family home in the prestigious Ikeja GRA. Mature garden, covered parking, inverter + generator backup, CCTV, and DSQ.",
      price: 35_000_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.UNDER_REVIEW,
    },
    passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: false, price_market_check: true, no_active_disputes: false, legal_consent: false },
    imageType: "house",
  });
  console.log(`   ✓ [${l4.listingId}] Ikeja GRA House — UNDER_REVIEW truthIndex=${l4.truthIndex}`);

  const l5 = await seedListing({
    ownerId: emeka.id,
    property: { address: "55 Admiralty Way, Lekki Phase 1", city: "Lagos", state: "Lagos", lga: "Eti-Osa", propertyType: "Office" },
    listing: {
      title: "55 Sqm Prime Office Space, Lekki Phase 1",
      description: "Modern open-plan office space in a Grade-A building on Admiralty Way. Central AC, high-speed fibre, dedicated parking, and reception.",
      price: 11_000_000, category: ListingCategory.COMMERCIAL, riskState: RiskState.VERIFIED,
    },
    passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: false, no_active_disputes: true, legal_consent: false },
    imageType: "commercial",
  });
  console.log(`   ✓ [${l5.listingId}] Lekki Office — VERIFIED truthIndex=${l5.truthIndex}`);

  const l6 = await seedListing({
    ownerId: trust.id,
    property: { address: "Ada George Road, Port Harcourt", city: "Port Harcourt", state: "Rivers", lga: "Port Harcourt", propertyType: "Apartment", bedrooms: 2, bathrooms: 2 },
    listing: {
      title: "Self-Contained 2-Bedroom Flat, Ada George Road",
      description: "Compact and affordable 2-bedroom self-contain off Ada George Road. Tiled floors, prepaid meter, and secure compound.",
      price: 750_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.UNVERIFIED,
    },
    passedComponents: {},
    imageType: "apartment",
  });
  console.log(`   ✓ [${l6.listingId}] Port Harcourt Flat — UNVERIFIED truthIndex=${l6.truthIndex}`);

  // ── 4. Student lodge listings (Imo State) ───────────────────────────────────
  console.log("\n── Student Listings (Imo State) ──────────────────────────────");

  const studentListings = [
    {
      ownerId: emeka.id,
      property: { address: "School Gate Hostel Street, Ihiagwa", city: "Owerri", state: "Imo", lga: "Owerri West", propertyType: "Apartment", bedrooms: 1, bathrooms: 1 },
      listing: { title: "Self-Contain Room — 5 mins from FUTO Gate", description: "Tiled studio room, water, prepaid meter, 5-minute walk to FUTO main gate. Quiet environment, no flooding.", price: 120_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isStudentLodge: true, nearbySchool: "futo", distanceToSchool: "5 min walk", studentAmenities: ["Running water", "Prepaid meter", "Security", "Wi-Fi"], },
      passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: true, no_active_disputes: true, legal_consent: true } as Partial<Record<ComponentKey, boolean>>,
      imageType: "student" as keyof typeof IMAGES,
    },
    {
      ownerId: chukwudi.id,
      property: { address: "Ihiagwa Housing Estate, FUTO Area", city: "Owerri", state: "Imo", lga: "Owerri West", propertyType: "House", bedrooms: 2, bathrooms: 1 },
      listing: { title: "Shared 2-Bedroom Lodge — FUTO Housing Estate", description: "Spacious 2-bedroom lodge in FUTO Housing Estate. Shared bathroom, bore-hole water, gated compound, generator hookup.", price: 85_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isStudentLodge: true, nearbySchool: "futo", distanceToSchool: "10 min walk", studentAmenities: ["Borehole water", "Generator hookup", "Parking"], },
      passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: true, no_active_disputes: true, legal_consent: false } as Partial<Record<ComponentKey, boolean>>,
      imageType: "student" as keyof typeof IMAGES,
    },
    {
      ownerId: aisha.id,
      property: { address: "Obinze Road, near Poly Nekede", city: "Owerri", state: "Imo", lga: "Owerri West", propertyType: "Apartment", bedrooms: 1, bathrooms: 1 },
      listing: { title: "Furnished Self-Contain, 3 mins to Poly Nekede", description: "Furnished self-contain with wardrobe, ceiling fan, water heater, and prepaid electricity. Landlord lives on-site.", price: 95_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isStudentLodge: true, nearbySchool: "poly-nekede", distanceToSchool: "3 min walk", studentAmenities: ["Furnished", "Running water", "Prepaid meter", "Water heater"], },
      passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: true, no_active_disputes: true, legal_consent: true } as Partial<Record<ComponentKey, boolean>>,
      imageType: "student" as keyof typeof IMAGES,
    },
    {
      ownerId: bola.id,
      property: { address: "Nekede Junction, Owerri-Aba Expressway", city: "Owerri", state: "Imo", lga: "Owerri West", propertyType: "Apartment", bedrooms: 1, bathrooms: 1 },
      listing: { title: "Room and Parlour — Nekede Junction (Poly Nekede)", description: "Room and parlour unit at Nekede junction. Tiled, water closet toilet, electric water pump, safe for female students.", price: 110_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.UNDER_REVIEW, isStudentLodge: true, nearbySchool: "poly-nekede", distanceToSchool: "8 min walk", studentAmenities: ["WC toilet", "Water pump", "Security", "Female-friendly"], },
      passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: false, price_market_check: true, no_active_disputes: false, legal_consent: false } as Partial<Record<ComponentKey, boolean>>,
      imageType: "student" as keyof typeof IMAGES,
    },
    {
      ownerId: trust.id,
      property: { address: "Agbowo Street, IMSU Road", city: "Owerri", state: "Imo", lga: "Owerri Municipal", propertyType: "Apartment", bedrooms: 1, bathrooms: 1 },
      listing: { title: "Self-Contain Lodge — 7 mins from IMSU Main Gate", description: "Clean self-contain room off IMSU road. Tiled, treated water supply, 24-hr security, quiet student environment.", price: 130_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isStudentLodge: true, nearbySchool: "imsu", distanceToSchool: "7 min walk", studentAmenities: ["Treated water", "24-hr security", "Tiled", "Prepaid meter"], },
      passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: true, no_active_disputes: true, legal_consent: false } as Partial<Record<ComponentKey, boolean>>,
      imageType: "student" as keyof typeof IMAGES,
    },
    {
      ownerId: emeka.id,
      property: { address: "Alvan Ikoku Road, Owerri", city: "Owerri", state: "Imo", lga: "Owerri Municipal", propertyType: "Apartment", bedrooms: 1, bathrooms: 1 },
      listing: { title: "New Build Student Room — Alvan Ikoku FCE Area", description: "Newly completed student lodge near Alvan Ikoku College. Modern finishings, solar backup, strong borehole, clean environment.", price: 100_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isStudentLodge: true, nearbySchool: "alvan-ikoku", distanceToSchool: "4 min walk", studentAmenities: ["Solar backup", "Borehole", "New building", "Tiled"], },
      passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: false, no_active_disputes: true, legal_consent: false } as Partial<Record<ComponentKey, boolean>>,
      imageType: "student" as keyof typeof IMAGES,
    },
    {
      ownerId: chukwudi.id,
      property: { address: "Imo Poly Area, World Bank Housing", city: "Owerri", state: "Imo", lga: "Owerri West", propertyType: "Apartment", bedrooms: 1, bathrooms: 1 },
      listing: { title: "Budget Self-Contain — Imo Poly World Bank Area", description: "Budget-friendly self-contain close to Imo Poly. Shared compound, good access road, cheap maintenance fee.", price: 70_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.UNVERIFIED, isStudentLodge: true, nearbySchool: "imo-poly", distanceToSchool: "12 min walk", studentAmenities: ["Affordable", "Access road"], },
      passedComponents: {} as Partial<Record<ComponentKey, boolean>>,
      imageType: "student" as keyof typeof IMAGES,
    },
    {
      ownerId: bola.id,
      property: { address: "New Owerri Exclusive Estate, Owerri", city: "Owerri", state: "Imo", lga: "Owerri North", propertyType: "Apartment", bedrooms: 2, bathrooms: 2 },
      listing: { title: "Premium 2-Bedroom Student Suite — New Owerri", description: "Premium lodge option for postgraduate students or groups. En-suite bathrooms, gas cooker point, 24-hr power and security.", price: 280_000, category: ListingCategory.RESIDENTIAL, riskState: RiskState.VERIFIED, isFeatured: true, isStudentLodge: true, nearbySchool: "imsu", distanceToSchool: "15 min by keke", studentAmenities: ["En-suite", "Gas cooker point", "24-hr power", "Generator", "Security"], },
      passedComponents: { title_document: true, landlord_identity: true, agent_physical_visit: true, price_market_check: true, no_active_disputes: true, legal_consent: true } as Partial<Record<ComponentKey, boolean>>,
      imageType: "student" as keyof typeof IMAGES,
    },
  ];

  for (const s of studentListings) {
    const r = await seedListing(s);
    console.log(`   ✓ [${r.listingId}] ${s.listing.nearbySchool?.toUpperCase()} — ${s.listing.riskState} truthIndex=${r.truthIndex}`);
  }

  // ── 5. Final counts ─────────────────────────────────────────────────────────
  const [lCount, pCount, tCount] = await Promise.all([
    prisma.listing.count(),
    prisma.property.count(),
    prisma.trustComponent.count(),
  ]);

  console.log("\n✅ Seed complete.\n");
  console.log("## Seed Result");
  console.log(`\n### Counts`);
  console.log(`- Listings: ${lCount}`);
  console.log(`- Properties: ${pCount}`);
  console.log(`- TrustComponents: ${tCount}`);
  console.log("\n### Credentials");
  console.log("- Admin:    seed-admin@lodgist.ng   / Seed2026!");
  console.log("- Landlord: seed-emeka@lodgist.ng   / Seed2026!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
