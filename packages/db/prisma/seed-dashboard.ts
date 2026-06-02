/**
 * seed-dashboard.ts — student lodge finder demo data
 *
 * Run from packages/db/:
 *   npx tsx prisma/seed-dashboard.ts
 */

import "dotenv/config";
import {
  PrismaClient,
  ListingCategory,
  ListingStatus,
  Currency,
  Role,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hash } from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const passwordHash = await hash("TestLandlord123!", 12);

  const landlord = await prisma.user.upsert({
    where: { email: "seed-dashboard-landlord@lodgist.local" },
    create: {
      email: "seed-dashboard-landlord@lodgist.local",
      name: "Dashboard Test Landlord",
      passwordHash,
      role: Role.LANDLORD,
    },
    update: {},
  });

  const verifiedData = [
    {
      title: "Self-Contain near FUTO Main Gate",
      description: "Fully furnished self-contain with 24/7 security and water supply. Walking distance to FUTO main gate.",
      address: "Ihiagwa, Owerri West",
      price: 85000,
      propertyType: "self-contain",
      bedrooms: 1,
      bathrooms: 1,
      studentAmenities: ["Generator", "Security", "Water 24/7", "Tiled Floors"],
      isStudentLodge: true,
      nearbySchool: "FUTO",
      distanceToSchool: "5 min walk",
      source: "USER_CREATED" as const,
      publishedAt: new Date(),
    },
    {
      title: "1-Bedroom Apartment near Poly Nekede",
      description: "Spacious 1-bedroom apartment close to Federal Polytechnic Nekede. Kitchen, tiled floors, good drainage.",
      address: "Nekede Road, Owerri West",
      price: 120000,
      propertyType: "apartment",
      bedrooms: 1,
      bathrooms: 1,
      studentAmenities: ["Generator", "Tiled Floors", "Kitchen", "Security"],
      isStudentLodge: true,
      nearbySchool: "Poly Nekede",
      distanceToSchool: "10 min walk",
      source: "USER_CREATED" as const,
      publishedAt: new Date(),
    },
    {
      title: "Shared Lodge near IMSU",
      description: "Clean single room in shared lodge compound near IMSU. Shared kitchen, good community of students.",
      address: "Ikenegbu Layout, Owerri",
      price: 65000,
      propertyType: "single-room",
      bedrooms: 1,
      bathrooms: 1,
      studentAmenities: ["Shared Kitchen", "Security", "Water"],
      isStudentLodge: true,
      nearbySchool: "IMSU",
      distanceToSchool: "7 min walk",
      source: "USER_CREATED" as const,
      publishedAt: new Date(),
    },
  ];

  const scrapedData = [
    {
      title: "2-Bedroom Flat (via PropertyPro)",
      description: "Spacious 2-bedroom flat in World Bank area. Available immediately.",
      address: "World Bank Housing Estate, Owerri",
      price: 600000,
      propertyType: "flat",
      bedrooms: 2,
      bathrooms: 2,
      studentAmenities: ["Generator", "Parking"],
      isStudentLodge: false,
      source: "SCRAPED_EXTERNAL" as const,
      sourceName: "PropertyPro",
      sourceUrl: "https://propertypro.ng",
      estimatedAgentFee: 60000,
      publishedAt: new Date(),
    },
    {
      title: "Single Room near FUTO (via Jiji)",
      description: "Single room self-contain in Ihiagwa, short walk to FUTO. Water and electricity.",
      address: "Ihiagwa, Owerri",
      price: 90000,
      propertyType: "single-room",
      bedrooms: 1,
      bathrooms: 1,
      studentAmenities: ["Water"],
      isStudentLodge: true,
      nearbySchool: "FUTO",
      distanceToSchool: "15 min walk",
      source: "SCRAPED_EXTERNAL" as const,
      sourceName: "Jiji",
      sourceUrl: "https://jiji.ng",
      estimatedAgentFee: 9000,
      publishedAt: new Date(),
    },
    {
      title: "3-Bedroom Bungalow (via Facebook)",
      description: "3-bedroom bungalow in Avu with generator, borehole and parking space.",
      address: "Avu, Owerri West",
      price: 800000,
      propertyType: "bungalow",
      bedrooms: 3,
      bathrooms: 2,
      studentAmenities: ["Generator", "Borehole", "Parking"],
      isStudentLodge: false,
      source: "SCRAPED_EXTERNAL" as const,
      sourceName: "Facebook",
      estimatedAgentFee: 80000,
      publishedAt: new Date(),
    },
  ];

  let verifiedCount = 0;
  let scrapedCount = 0;

  for (const data of verifiedData) {
    await prisma.listing.create({
      data: {
        ...data,
        ownerId: landlord.id,
        description: data.description,
        currency: Currency.NGN,
        category: ListingCategory.RESIDENTIAL,
        status: ListingStatus.VERIFIED,
      },
    });
    verifiedCount++;
  }

  for (const data of scrapedData) {
    await prisma.listing.create({
      data: {
        ...data,
        ownerId: landlord.id,
        description: data.description,
        currency: Currency.NGN,
        category: ListingCategory.RESIDENTIAL,
        status: ListingStatus.VERIFIED,
      },
    });
    scrapedCount++;
  }

  console.log(
    `✅ Seeded ${verifiedCount} verified + ${scrapedCount} scraped listings`
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
