import { PrismaClient, Role, ListingStatus, BookingStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

// Parse DATABASE_URL into individual params to avoid SASL/SCRAM issues with special chars in connection strings
const dbUrl = new URL(process.env.DATABASE_URL!);
const pool = new pg.Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || "5432"),
  database: dbUrl.pathname.replace(/^\//, ""),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database... Lodgist v5.0");

  // ─── Clean existing data (FK-safe order) ────────────────────────────────
  await prisma.review.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.truthIndexScore.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
  console.log("  ✓ Existing data cleared");

  // ─── Users ──────────────────────────────────────────────────────────────
  // Role is an enum (USER, ARTISAN, LANDLORD, STUDIO_ADMIN, TENANT, AGENT)
  const adminPassword = await bcrypt.hash("Admin2026!", 10);
  const landlordPassword = await bcrypt.hash("Landlord2026!", 10);
  const tenantPassword = await bcrypt.hash("Tenant2026!", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@lodgist.ng",
      passwordHash: adminPassword,
      name: "Lodgist Admin",
      role: Role.STUDIO_ADMIN,
    },
  });

  const emeka = await prisma.user.create({
    data: {
      email: "emeka@lodgist.ng",
      passwordHash: landlordPassword,
      name: "Emeka Okafor",
      role: Role.LANDLORD,
    },
  });

  const fatima = await prisma.user.create({
    data: {
      email: "fatima@lodgist.ng",
      passwordHash: landlordPassword,
      name: "Fatima Bello",
      role: Role.LANDLORD,
    },
  });

  const chioma = await prisma.user.create({
    data: {
      email: "chioma@lodgist.ng",
      passwordHash: tenantPassword,
      name: "Chioma Eze",
      role: Role.USER, // TENANT maps to USER via ROLE_MAP
    },
  });

  const amina = await prisma.user.create({
    data: {
      email: "amina@lodgist.ng",
      passwordHash: tenantPassword,
      name: "Amina Yusuf",
      role: Role.USER,
    },
  });
  console.log("  ✓ Users created (admin, 2 landlords, 2 tenants)");

  // ─── Properties (12) ────────────────────────────────────────────────────
  // Property fields: address, city, state, lga, ownerId
  // No zip or truthIndex fields on Property model
  const propertyData = [
    { address: "15B Admiralty Way, Lekki Phase 1", city: "Lekki", state: "Lagos", lga: "Eti Osa", ownerId: emeka.id },
    { address: "24 Durban Street, Wuse 2", city: "Wuse", state: "FCT", lga: "Municipal", ownerId: emeka.id },
    { address: "8A Adeola Odeku, Victoria Island", city: "Victoria Island", state: "Lagos", lga: "Eti Osa", ownerId: emeka.id },
    { address: "12 Forces Avenue, GRA Phase 2", city: "Port Harcourt", state: "Rivers", lga: "Obio/Akpor", ownerId: fatima.id },
    { address: "33B Bourdillon Road, Ikoyi", city: "Ikoyi", state: "Lagos", lga: "Eti Osa", ownerId: emeka.id },
    { address: "5 Wetheral Road, Owerri Municipal", city: "Owerri", state: "Imo", lga: "Owerri Municipal", ownerId: fatima.id },
    { address: "77 Adeniran Ogunsanya Street, Surulere", city: "Surulere", state: "Lagos", lga: "Surulere", ownerId: emeka.id },
    { address: "2 Aguiyi Ironsi Street, Maitama", city: "Maitama", state: "FCT", lga: "Municipal", ownerId: fatima.id },
    { address: "18 Ogui Road, Independence Layout", city: "Enugu", state: "Enugu", lga: "Enugu North", ownerId: fatima.id },
    { address: "45 Allen Avenue, Ikeja", city: "Ikeja", state: "Lagos", lga: "Ikeja", ownerId: emeka.id },
    { address: "9 Kano Street, Area 11, Garki", city: "Garki", state: "FCT", lga: "Municipal", ownerId: fatima.id },
    { address: "30 Ihama Road, GRA", city: "Benin City", state: "Edo", lga: "Oredo", ownerId: fatima.id },
  ];

  const properties = await Promise.all(
    propertyData.map((p) => prisma.property.create({ data: p }))
  );
  console.log("  ✓ 12 properties created");

  // ─── Listings (12) ──────────────────────────────────────────────────────
  // Listing fields: propertyId, ownerId, title, description, price, status (enum)
  // No agentId field on Listing model
  const priceByCity: Record<string, number> = {
    "Lekki": 1_200_000,
    "Victoria Island": 1_500_000,
    "Ikoyi": 1_800_000,
    "Wuse": 900_000,
    "Garki": 700_000,
    "Maitama": 1_000_000,
    "Port Harcourt": 600_000,
    "Surulere": 500_000,
    "Ikeja": 550_000,
    "Owerri": 350_000,
    "Enugu": 400_000,
    "Benin City": 450_000,
  };

  const descriptionByCity: Record<string, string> = {
    "Lekki": "Luxury duplex in Lekki Phase 1 with 24/7 security, backup generator, dedicated parking, and spacious interiors. Walking distance to the Lekki-Ikoyi link bridge and major shopping centres.",
    "Wuse": "Well-furnished self-contained flat in the prestigious Wuse 2 district. Features modern kitchen, tiled floors, ample wardrobe space, and a serene neighbourhood. Ideal for professionals.",
    "Victoria Island": "Executive apartment in Victoria Island's business district. Modern finishes, 24-hour security, and easy access to major banks, hotels, and corporate offices.",
    "Port Harcourt": "Neat mini flat in GRA Phase 2, Port Harcourt. Modern kitchen fittings, tiled floors, and a balcony overlooking the serene neighbourhood. Includes dedicated parking.",
    "Ikoyi": "Luxury penthouse suite in the exclusive Ikoyi neighbourhood. Smart home automation, panoramic views, top-notch security, and premium finishes throughout.",
    "Owerri": "Modern city-centre studio in Owerri. Located on Wetheral Road with good road network, drainage, and proximity to markets, schools, and hospitals. Ideal for students and young professionals.",
    "Surulere": "Well-maintained 2-bedroom flat in Surulere. Spacious living area, modern kitchen, and close to public transport. Perfect for a small family.",
    "Maitama": "Luxury terrace in Maitama district. Private garden, CCTV security, modern fittings, and staff quarters. Perfect for families seeking comfort and security in Abuja.",
    "Enugu": "Spacious flat in Independence Layout, Enugu. Modern finishes, secure compound, and walking distance to major landmarks. Great for professionals and families.",
    "Ikeja": "Convenient mini flat on Allen Avenue, Ikeja. Modern kitchen, tiled floors, and close to shopping malls, restaurants, and public transport.",
    "Garki": "Self-contained flat in Area 11, Garki. Affordable and well-maintained with good road network and proximity to government offices and markets.",
    "Benin City": "Spacious duplex in GRA, Benin City. Modern architecture, secure compound, ample parking, and lush garden. Ideal for families and executives.",
  };

  const listingsData = properties.map((property) => ({
    propertyId: property.id,
    ownerId: property.ownerId,
    title: `${property.city} Property - ${property.address.split(",")[0]}`,
    description: descriptionByCity[property.city] ?? `Property in ${property.city}`,
    price: priceByCity[property.city] ?? 500_000,
    status: ListingStatus.VERIFIED,
    isFlaggedForFraud: false,
  }));

  const listings = await Promise.all(
    listingsData.map((data) =>
      prisma.listing.create({ data })
    )
  );
  console.log("  ✓ 12 listings created");

  // ─── Listing Images (24-36 — 2-3 per listing) ───────────────────────────
  const imagePool = [
    { url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800", altText: "Modern living room with large windows" },
    { url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", altText: "Spacious kitchen with modern fittings" },
    { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800", altText: "Cozy bedroom with natural lighting" },
    { url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", altText: "Elegant dining area" },
    { url: "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800", altText: "Beautiful exterior view" },
    { url: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800", altText: "Well-lit hallway" },
    { url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800", altText: "Property exterior with garden" },
    { url: "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800", altText: "Balcony with city view" },
    { url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800", altText: "Luxury bathroom with modern fixtures" },
    { url: "https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800", altText: "Rooftop terrace area" },
    { url: "https://images.unsplash.com/photo-1600566753086-00f18f6b0252?w=800", altText: "Swimming pool area" },
    { url: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800", altText: "Secure entrance with gate" },
  ];

  for (const listing of listings) {
    // listing.id is Int — use modulus to pick starting index
    const startIdx = listing.id % imagePool.length;
    const imageCount = 2 + (listing.id % 2); // 2 or 3 images
    for (let i = 0; i < imageCount; i++) {
      const idx = (startIdx + i) % imagePool.length;
      await prisma.listingImage.create({
        data: {
          listingId: listing.id,
          url: imagePool[idx].url,
          altText: imagePool[idx].altText,
        },
      });
    }
  }
  console.log("  ✓ Listing images created (2-3 per listing)");

  // ─── Reviews (24 — 2 per listing) ───────────────────────────────────────
  // Must respect @@unique([listingId, userId]) constraint.
  // Chioma reviews all listings, Amina reviews all listings = 24 reviews total.
  const reviewTextPool = [
    "Clean and quiet environment. Landlord very responsive.",
    "Good value for money. Would recommend.",
    "Great location, but parking can be tight.",
    "Well maintained property. Happy tenant for 2 years.",
    "The estate is secure and family-friendly.",
    "Water supply is irregular, but the apartment itself is top-notch.",
    "Modern finishes and close to public transport.",
    "Landlord replaced faulty AC within 24 hours. Excellent service.",
    "Spacious rooms and 24-hour security.",
    "The compound is well kept and the neighbours are friendly.",
    "Excellent location with easy access to major roads.",
    "The property exceeded my expectations. Very satisfied.",
  ];

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    // Chioma's review (uses text from pool, cycled)
    await prisma.review.create({
      data: {
        listingId: listing.id,
        userId: chioma.id,
        rating: 4 + (i % 2), // alternates 4, 5
        comment: reviewTextPool[i % reviewTextPool.length],
      },
    });
    // Amina's review (offset by listing length for variety)
    await prisma.review.create({
      data: {
        listingId: listing.id,
        userId: amina.id,
        rating: 4 + ((i + 1) % 2), // alternates 5, 4
        comment: reviewTextPool[(i + 6) % reviewTextPool.length],
      },
    });
  }
  console.log("  ✓ 24 reviews created (2 per listing)");

  // ─── Bookings (3) ───────────────────────────────────────────────────────
  const now = new Date();

  // 1. Pending booking — Lekki (listings[0]), starts 1 week from now, 30 days
  await prisma.booking.create({
    data: {
      listingId: listings[0].id,
      tenantId: chioma.id,
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: BookingStatus.PENDING,
      totalAmount: listings[0].price,
    },
  });

  // 2. Confirmed booking — Wuse (listings[1]), started 2 weeks ago, ends 16 days from now
  await prisma.booking.create({
    data: {
      listingId: listings[1].id,
      tenantId: chioma.id,
      startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000),
      status: BookingStatus.CONFIRMED,
      totalAmount: listings[1].price,
    },
  });

  // 3. Cancelled booking — Victoria Island (listings[2])
  await prisma.booking.create({
    data: {
      listingId: listings[2].id,
      tenantId: amina.id,
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      status: BookingStatus.CANCELLED,
      totalAmount: listings[2].price,
    },
  });
  console.log("  ✓ 3 bookings created (1 pending, 1 confirmed, 1 cancelled)");

  // ─── Truth Index Scores (2 — one per landlord) ──────────────────────────
  // TruthIndexScore is per-user (userId), not per-property (no propertyId)
  // Create scores for the landlord users
  const landlordScores = [
    { userId: emeka.id, score: 90, activityScore: 85, verificationScore: 92, ratingScore: 88 },
    { userId: fatima.id, score: 85, activityScore: 80, verificationScore: 88, ratingScore: 84 },
  ];

  for (const score of landlordScores) {
    await prisma.truthIndexScore.create({
      data: {
        userId: score.userId,
        score: score.score,
        activityScore: score.activityScore,
        verificationScore: score.verificationScore,
        ratingScore: score.ratingScore,
        metadata: {
          source: "lodgist-v5-seed",
          lastChecked: now.toISOString(),
        },
      },
    });
  }
  console.log("  ✓ Truth Index scores created for landlords");

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log("\n✅ Seeding complete! Lodgist v5.0");
  console.log("\n📧 Test accounts:");
  console.log("   Admin:    admin@lodgist.ng / Admin2026!");
  console.log("   Landlord: emeka@lodgist.ng / Landlord2026!");
  console.log("   Landlord: fatima@lodgist.ng / Landlord2026!");
  console.log("   Tenant:   chioma@lodgist.ng / Tenant2026!");
  console.log("   Tenant:   amina@lodgist.ng / Tenant2026!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
