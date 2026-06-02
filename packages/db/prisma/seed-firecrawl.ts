/**
 * seed-firecrawl.ts — scrape real Nigerian student lodge listings via Firecrawl
 *
 * Sources: NigeriaPropertyCentre (Imo/Owerri), Jiji.ng (Owerri)
 *
 * Run from packages/db/:
 *   npx tsx prisma/seed-firecrawl.ts
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
import { execSync } from "child_process";
import { parse as parseUrl } from "url";

// ── DB: IPv4-resolved pool (mirrors packages/db/src/client.js) ───────────────

function resolveIPv4(hostname: string): string | null {
  try {
    return (
      execSync(
        `dig +short A ${hostname} | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -1`,
        { timeout: 3000 }
      )
        .toString()
        .trim() || null
    );
  } catch {
    return null;
  }
}

function buildPool(connStr: string): pg.Pool {
  const p = parseUrl(connStr);
  const hostname = p.hostname ?? "";
  const ipv4 = resolveIPv4(hostname);
  const auth = p.auth ?? "";
  const ci = auth.indexOf(":");
  const user = ci >= 0 ? auth.slice(0, ci) : auth;
  const password = ci >= 0 ? auth.slice(ci + 1) : undefined;
  const database = (p.pathname ?? "/").slice(1);
  const port = p.port ? parseInt(p.port, 10) : 5432;
  const host = ipv4 && ipv4 !== hostname ? ipv4 : hostname;
  console.log(`  DB: ${hostname} → ${host}`);
  return new pg.Pool({
    host, port, database, user, password,
    ssl: { rejectUnauthorized: false, servername: hostname },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 60000,
    max: 3,
  });
}

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");
const pool = buildPool(DB_URL);
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── Firecrawl ─────────────────────────────────────────────────────────────────

const FC_KEY = process.env.FIRECRAWL_API_KEY;
if (!FC_KEY) throw new Error("FIRECRAWL_API_KEY not set");

async function scrape(url: string, timeoutMs = 45000): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${FC_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: false,
      timeout: timeoutMs,
      waitFor: 2000,
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { data?: { markdown?: string }; markdown?: string };
  return d.data?.markdown ?? d.markdown ?? "";
}

// ── Gemini ────────────────────────────────────────────────────────────────────

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set");

interface Listing {
  title: string;
  price: number;
  address: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: string[];
  nearbySchool: string | null;
  distanceToSchool: string | null;
  isStudentLodge: boolean;
  sourceUrl: string;
}

// NigeriaPropertyCentre markdown structure guide for Gemini
const NPC_EXAMPLE = `Example listing in NPC markdown:
[**3 Bedroom Flat / Apartment for Rent**](https://nigeriapropertycentre.com/for-rent/...)
**Owerri, Imo**
3 bedroom flat available at Owerri. Generator included.
₦800,000 per annum
- 3Bedrooms
- 2Bathrooms`;

// Jiji markdown structure guide
const JIJI_EXAMPLE = `Example listing in Jiji markdown:
**Self Contain for Rent in Owerri**
Self-contain, 1 bedroom, bathroom
Location: Owerri, Imo
Price: ₦120,000/yr`;

async function extractListings(
  markdown: string,
  pageUrl: string,
  sourceName: string
): Promise<Listing[]> {
  if (markdown.length < 200) return [];

  // Auto-detect where listings begin: find "Results 1" or first ₦ price line
  let contentStart = 0;
  const resultsIdx = markdown.indexOf("Results 1");
  if (resultsIdx !== -1) {
    contentStart = resultsIdx;
  } else {
    // fallback: find the first actual price line (₦ followed by digits)
    const priceMatch = markdown.match(/₦[\d,]+/);
    if (priceMatch?.index) contentStart = Math.max(0, priceMatch.index - 500);
  }
  const chunk = markdown.slice(contentStart, contentStart + 16000);

  const example = sourceName === "NigeriaPropertyCentre" ? NPC_EXAMPLE : JIJI_EXAMPLE;

  const prompt = `Extract property listings from this Nigerian real estate page markdown.

${example}

Rules:
- price: annual NGN rent as integer. "800k" = 800000. "1.5m" = 1500000. Monthly price × 12. Skip if unclear.
- propertyType: one of "self-contain"|"single-room"|"flat"|"apartment"|"duplex"|"bungalow"|"house"
- bedrooms/bathrooms: integer or null
- nearbySchool: if mentioned — "FUTO"|"IMSU"|"Poly Nekede"|"Alvan Ikoku"|"Imo Poly"|"Hope Uni" or null
- isStudentLodge: true if mentions student/lodge/hostel or school proximity
- amenities: e.g. ["Generator","Security","Borehole","Tiled Floors","Kitchen","Parking","Water","Furnished"]
- address: city + area, e.g. "Owerri, Imo" or "Ihiagwa, Owerri West"
- Skip Lagos/Abuja/non-Imo-State listings — we only want Imo State (Owerri, Ihiagwa, Nekede, etc.)

Return a JSON array only. No prose. Empty array if no Imo State listings found.

Markdown:
${chunk}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );
    const d = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    const arr = JSON.parse(cleaned) as Listing[];
    return arr
      .filter((l) => l.title && l.price > 5000 && l.price < 20_000_000)
      .map((l) => ({ ...l, sourceUrl: pageUrl }));
  } catch (e) {
    console.warn(`  ⚠ Gemini extract failed: ${(e as Error).message}`);
    return [];
  }
}

// ── Scrape targets ─────────────────────────────────────────────────────────────

const TARGETS = [
  {
    name: "NigeriaPropertyCentre",
    urls: [
      "https://nigeriapropertycentre.com/for-rent/imo",
      "https://nigeriapropertycentre.com/for-rent/flats-apartments/imo",
      "https://nigeriapropertycentre.com/for-rent/houses/imo",
    ],
  },
  {
    name: "Jiji",
    urls: [
      "https://jiji.ng/owerri/houses-apartments-for-rent",
      "https://jiji.ng/imo-state/houses-apartments-for-rent",
    ],
  },
];

// ── Verified seed data ────────────────────────────────────────────────────────

const VERIFIED_LODGES = [
  {
    title: "Self-Contain near FUTO Main Gate",
    description:
      "Fully furnished self-contain. 24/7 security, water supply, tiled floors. Walking distance to FUTO main gate.",
    address: "Ihiagwa, Owerri West",
    price: 85000,
    propertyType: "self-contain",
    bedrooms: 1,
    bathrooms: 1,
    studentAmenities: ["Generator", "Security", "Water 24/7", "Tiled Floors"],
    isStudentLodge: true,
    nearbySchool: "FUTO",
    distanceToSchool: "5 min walk",
  },
  {
    title: "1-Bedroom Apartment near Poly Nekede",
    description:
      "Spacious 1-bed near Federal Polytechnic Nekede. Kitchen, tiled floors, good drainage.",
    address: "Nekede Road, Owerri West",
    price: 120000,
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    studentAmenities: ["Generator", "Tiled Floors", "Kitchen", "Security"],
    isStudentLodge: true,
    nearbySchool: "Poly Nekede",
    distanceToSchool: "10 min walk",
  },
  {
    title: "Shared Lodge near IMSU",
    description:
      "Clean single room in well-managed student compound near IMSU. Shared kitchen, good security.",
    address: "Ikenegbu Layout, Owerri",
    price: 65000,
    propertyType: "single-room",
    bedrooms: 1,
    bathrooms: 1,
    studentAmenities: ["Shared Kitchen", "Security", "Water"],
    isStudentLodge: true,
    nearbySchool: "IMSU",
    distanceToSchool: "7 min walk",
  },
  {
    title: "2-Bedroom Flat near IMSU Library",
    description:
      "Spacious 2-bedroom flat in a quiet street near IMSU. Constant water, prepaid meter.",
    address: "Amawom, Owerri",
    price: 180000,
    propertyType: "flat",
    bedrooms: 2,
    bathrooms: 2,
    studentAmenities: ["Prepaid Meter", "Water", "Tiled Floors", "Kitchen"],
    isStudentLodge: true,
    nearbySchool: "IMSU",
    distanceToSchool: "12 min walk",
  },
  {
    title: "Self-Contain near Alvan Ikoku Gate",
    description:
      "New self-contain with ceramic tiles. Borehole water. 7 min walk to Alvan Ikoku College of Education.",
    address: "Egbu Road, Owerri",
    price: 90000,
    propertyType: "self-contain",
    bedrooms: 1,
    bathrooms: 1,
    studentAmenities: ["Borehole Water", "Tiled Floors", "Security"],
    isStudentLodge: true,
    nearbySchool: "Alvan Ikoku",
    distanceToSchool: "7 min walk",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔑  Firecrawl ✓  Gemini ✓");

  const pwHash = await hash("ScraperSystem!2026", 12);
  const scraper = await prisma.user.upsert({
    where: { email: "seed-scraper@lodgist.local" },
    create: {
      email: "seed-scraper@lodgist.local",
      name: "Lodgist Scraper Bot",
      passwordHash: pwHash,
      role: Role.STUDIO_ADMIN,
    },
    update: {},
  });
  console.log(`✓ Scraper user ready (id: ${scraper.id})`);

  const landlordHash = await hash("TestLandlord123!", 12);
  const landlord = await prisma.user.upsert({
    where: { email: "seed-dashboard-landlord@lodgist.local" },
    create: {
      email: "seed-dashboard-landlord@lodgist.local",
      name: "Dashboard Test Landlord",
      passwordHash: landlordHash,
      role: Role.LANDLORD,
    },
    update: {},
  });

  // Verified listings (skip if already present)
  const existingVerified = await prisma.listing.count({
    where: { ownerId: landlord.id, source: "USER_CREATED" },
  });

  if (existingVerified === 0) {
    for (const data of VERIFIED_LODGES) {
      await prisma.listing.create({
        data: {
          ...data,
          ownerId: landlord.id,
          currency: Currency.NGN,
          category: ListingCategory.RESIDENTIAL,
          status: ListingStatus.VERIFIED,
          source: "USER_CREATED",
          publishedAt: new Date(),
        },
      });
    }
    console.log(`✓ Seeded ${VERIFIED_LODGES.length} verified listings`);
  } else {
    console.log(`  (${existingVerified} verified listings already exist — skipping)`);
  }

  // Scrape + seed
  let totalScraped = 0;
  const seenTitles = new Set<string>();

  for (const target of TARGETS) {
    console.log(`\n🔍 Scraping ${target.name}...`);
    for (const url of target.urls) {
      console.log(`  → ${url}`);
      try {
        await new Promise((r) => setTimeout(r, 2000));
        const markdown = await scrape(url, 50000);
        console.log(`  ✓ ${markdown.length} chars`);

        const listings = await extractListings(markdown, url, target.name);
        console.log(`  ✓ ${listings.length} listings extracted`);

        for (const l of listings) {
          const dedup = `${l.title}::${l.price}::${l.address}`.toLowerCase();
          if (seenTitles.has(dedup)) continue;
          seenTitles.add(dedup);

          const agentFee = l.price * 0.1;
          await prisma.listing.create({
            data: {
              title: l.title.substring(0, 200),
              description: `${l.propertyType} in ${l.address}. Sourced from ${target.name}.`,
              address: l.address,
              price: l.price,
              propertyType: l.propertyType,
              bedrooms: l.bedrooms,
              bathrooms: l.bathrooms,
              studentAmenities: l.amenities,
              isStudentLodge: l.isStudentLodge,
              nearbySchool: l.nearbySchool,
              distanceToSchool: l.distanceToSchool,
              currency: Currency.NGN,
              category: ListingCategory.RESIDENTIAL,
              status: ListingStatus.VERIFIED,
              source: "SCRAPED_EXTERNAL",
              sourceName: target.name,
              sourceUrl: l.sourceUrl,
              estimatedAgentFee: agentFee,
              isClaimable: true,
              publishedAt: new Date(),
              ownerId: scraper.id,
            },
          });
          totalScraped++;
        }
      } catch (e) {
        console.warn(`  ⚠ ${(e as Error).message.substring(0, 120)}`);
      }
    }
  }

  const verifiedCount = await prisma.listing.count({ where: { source: "USER_CREATED" } });
  const scrapedCount = await prisma.listing.count({ where: { source: "SCRAPED_EXTERNAL" } });
  console.log(`\n✅ Done. DB totals: ${verifiedCount} verified · ${scrapedCount} scraped (${totalScraped} new)`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
