import { PrismaClient } from "@prisma/client";
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
  console.log("🌱 Seeding database...");

  // ─── Clean existing data ───────────────────────────────────────────────
  await prisma.review.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.property.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.truthIndexScore.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  // ─── Roles ─────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.create({ data: { name: "ADMIN" } });
  const landlordRole = await prisma.role.create({ data: { name: "LANDLORD" } });
  const tenantRole = await prisma.role.create({ data: { name: "TENANT" } });
  console.log("  ✓ Roles created");

  // ─── Users ─────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@lodgist.com",
      password: hashedPassword,
      name: "Chidi Okafor",
      roleId: adminRole.id,
    },
  });

  const landlord = await prisma.user.create({
    data: {
      email: "landlord@lodgist.com",
      password: hashedPassword,
      name: "Fatima Bello",
      roleId: landlordRole.id,
    },
  });

  const tenant = await prisma.user.create({
    data: {
      email: "tenant@lodgist.com",
      password: hashedPassword,
      name: "Emeka Nwosu",
      roleId: tenantRole.id,
    },
  });
  console.log("  ✓ Users created (admin, landlord, tenant)");

  // ─── Properties ────────────────────────────────────────────────────────
  const properties = await Promise.all([
    prisma.property.create({
      data: {
        address: "12 Admiralty Way, Lekki Phase 1",
        city: "Lekki",
        state: "Lagos",
        zip: "105102",
        truthIndex: 92,
        ownerId: landlord.id,
      },
    }),
    prisma.property.create({
      data: {
        address: "45 Aminu Kano Crescent, Wuse 2",
        city: "Wuse",
        state: "FCT",
        zip: "900288",
        truthIndex: 88,
        ownerId: landlord.id,
      },
    }),
    prisma.property.create({
      data: {
        address: "Plot 7, Bishop Oluwole Street, Victoria Island",
        city: "Victoria Island",
        state: "Lagos",
        zip: "101241",
        truthIndex: 76,
        ownerId: landlord.id,
      },
    }),
    prisma.property.create({
      data: {
        address: "8 Woji Road, GRA Phase 2",
        city: "Port Harcourt",
        state: "Rivers",
        zip: "500272",
        truthIndex: 85,
        ownerId: landlord.id,
      },
    }),
    prisma.property.create({
      data: {
        address: "22 Bourdillon Road, Ikoyi",
        city: "Ikoyi",
        state: "Lagos",
        zip: "101233",
        truthIndex: 95,
        ownerId: landlord.id,
      },
    }),
    prisma.property.create({
      data: {
        address: "30 Ikenegbu Layout, Owerri Municipal",
        city: "Owerri",
        state: "Imo",
        zip: "460221",
        truthIndex: 71,
        ownerId: landlord.id,
      },
    }),
  ]);
  console.log("  ✓ 6 properties created");

  // ─── Listings ──────────────────────────────────────────────────────────
  const listingsData = [
    {
      propertyId: properties[0].id,
      price: 4500000,
      description:
        "Modern 3-bedroom apartment in the heart of Lekki Phase 1. Features include 24/7 security, backup generator, dedicated parking space, and a spacious living area. Walking distance to the Lekki-Ikoyi link bridge and major shopping centers.",
      status: "available",
    },
    {
      propertyId: properties[1].id,
      price: 8500000,
      description:
        "Spacious 4-bedroom duplex in the prestigious Wuse 2 district. Features a private swimming pool, lush garden, CCTV security, and staff quarters. Perfect for families seeking comfort and security in Abuja.",
      status: "available",
    },
    {
      propertyId: properties[2].id,
      price: 25000000,
      description:
        "Prime commercial plot in Victoria Island's business district. Located on Bishop Oluwole Street with high visibility and easy access to major banks, hotels, and corporate offices. Ideal for commercial development.",
      status: "available",
    },
    {
      propertyId: properties[3].id,
      price: 3200000,
      description:
        "Well-maintained 2-bedroom flat in GRA Phase 2, Port Harcourt. Features modern kitchen fittings, tiled floors, ample wardrobe space, and a balcony overlooking the serene neighborhood. Includes dedicated parking.",
      status: "available",
    },
    {
      propertyId: properties[4].id,
      price: 18000000,
      description:
        "Luxury 5-bedroom villa in the exclusive Ikoyi neighborhood. Smart home automation, infinity pool, landscaped garden, CCTV, and staff quarters. The epitome of luxury living in Lagos.",
      status: "available",
    },
    {
      propertyId: properties[5].id,
      price: 1200000,
      description:
        "Affordable 2-bedroom bungalow in the heart of Owerri. Located in the peaceful Ikenegbu Layout with good road network, drainage, and proximity to markets, schools, and hospitals. Ideal for students and young professionals.",
      status: "available",
    },
  ];

  const listings = await Promise.all(
    listingsData.map((data) =>
      prisma.listing.create({
        data: {
          ...data,
          agentId: admin.id,
        },
      })
    )
  );
  console.log("  ✓ 6 listings created");

  // ─── Listing Images ────────────────────────────────────────────────────
  const imageUrls = [
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
  ];

  const imageAlts = [
    "Modern living room with large windows",
    "Spacious kitchen with modern fittings",
    "Cozy bedroom with natural lighting",
    "Elegant dining area",
    "Beautiful exterior view",
    "Well-lit hallway",
  ];

  for (const listing of listings) {
    // Each listing gets 3 images
    const startIdx = (parseInt(listing.id.slice(-2), 36) % 6);
    for (let i = 0; i < 3; i++) {
      const idx = (startIdx + i) % imageUrls.length;
      await prisma.listingImage.create({
        data: {
          listingId: listing.id,
          url: imageUrls[idx],
          alt: imageAlts[idx],
        },
      });
    }
  }
  console.log("  ✓ 18 listing images created (3 per listing)");

  // ─── Reviews ───────────────────────────────────────────────────────────
  const reviewData = [
    {
      listingId: listings[0].id,
      rating: 5,
      comment:
        "Excellent property! The Truth Index score of 92 is well deserved. The apartment is exactly as described and the landlord was very professional.",
    },
    {
      listingId: listings[0].id,
      rating: 4,
      comment:
        "Great location and beautiful apartment. The neighborhood is quiet and secure. Would recommend.",
    },
    {
      listingId: listings[1].id,
      rating: 5,
      comment:
        "One of the best properties in Wuse 2. The duplex is spacious and the pool area is perfect for entertaining guests.",
    },
    {
      listingId: listings[1].id,
      rating: 4,
      comment:
        "Very impressed with the verification process. The property matched all the photos and description.",
    },
    {
      listingId: listings[2].id,
      rating: 3,
      comment:
        "Good location for commercial purposes but the price is on the higher side. Truth Index of 76 seems accurate.",
    },
    {
      listingId: listings[2].id,
      rating: 4,
      comment:
        "Prime location in VI. Easy access to major business hubs. Worth the investment.",
    },
    {
      listingId: listings[3].id,
      rating: 5,
      comment:
        "Perfect flat for a young professional. The GRA neighborhood is safe and well-maintained. Love the balcony view.",
    },
    {
      listingId: listings[3].id,
      rating: 4,
      comment:
        "Good value for money in Port Harcourt. The apartment is well-furnished and move-in ready.",
    },
    {
      listingId: listings[4].id,
      rating: 5,
      comment:
        "Absolutely stunning villa! The smart home features are incredible and the infinity pool is a dream. Worth every naira.",
    },
    {
      listingId: listings[4].id,
      rating: 5,
      comment:
        "The Ikoyi villa exceeded our expectations. Top-notch security and the staff quarters are a great addition.",
    },
    {
      listingId: listings[5].id,
      rating: 4,
      comment:
        "Great affordable option in Owerri. The neighborhood is peaceful and the property is well-maintained. Perfect for students.",
    },
    {
      listingId: listings[5].id,
      rating: 3,
      comment:
        "Decent property for the price. Could use some renovations but overall a good find in Imo State.",
    },
  ];

  for (const review of reviewData) {
    await prisma.review.create({
      data: {
        ...review,
        userId: tenant.id,
      },
    });
  }
  console.log("  ✓ 12 reviews created (2 per listing)");

  // ─── Bookings ──────────────────────────────────────────────────────────
  const now = new Date();

  // Pending booking
  await prisma.booking.create({
    data: {
      listingId: listings[0].id,
      tenantId: tenant.id,
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 1 month from now
      status: "pending",
    },
  });

  // Confirmed booking
  await prisma.booking.create({
    data: {
      listingId: listings[1].id,
      tenantId: tenant.id,
      startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
      endDate: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000), // 16 days from now
      status: "confirmed",
    },
  });
  console.log("  ✓ 2 bookings created (1 pending, 1 confirmed)");

  // ─── Truth Index Scores ────────────────────────────────────────────────
  const truthScores = [
    {
      propertyId: properties[0].id,
      score: 92,
      breakdown: {
        images: 20,
        description: 15,
        verifiedOwner: 25,
        priceFairness: 17,
        reviews: 15,
      },
    },
    {
      propertyId: properties[1].id,
      score: 88,
      breakdown: {
        images: 18,
        description: 14,
        verifiedOwner: 25,
        priceFairness: 16,
        reviews: 15,
      },
    },
    {
      propertyId: properties[2].id,
      score: 76,
      breakdown: {
        images: 15,
        description: 12,
        verifiedOwner: 20,
        priceFairness: 14,
        reviews: 15,
      },
    },
    {
      propertyId: properties[3].id,
      score: 85,
      breakdown: {
        images: 17,
        description: 13,
        verifiedOwner: 25,
        priceFairness: 15,
        reviews: 15,
      },
    },
    {
      propertyId: properties[4].id,
      score: 95,
      breakdown: {
        images: 20,
        description: 15,
        verifiedOwner: 25,
        priceFairness: 18,
        reviews: 17,
      },
    },
    {
      propertyId: properties[5].id,
      score: 71,
      breakdown: {
        images: 14,
        description: 11,
        verifiedOwner: 20,
        priceFairness: 16,
        reviews: 10,
      },
    },
  ];

  for (const score of truthScores) {
    await prisma.truthIndexScore.create({
      data: score,
    });
  }
  console.log("  ✓ 6 Truth Index scores created");

  console.log("\n✅ Seeding complete!");
  console.log("\n📧 Test accounts:");
  console.log("   Admin:    admin@lodgist.com / password123");
  console.log("   Landlord: landlord@lodgist.com / password123");
  console.log("   Tenant:   tenant@lodgist.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
