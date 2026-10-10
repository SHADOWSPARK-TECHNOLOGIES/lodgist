/**
 * Repeatable Owerri pilot seed.
 *
 * Loads the records a real Lodgist-reviewed home needs when founder-supplied
 * facts are present. Review-for-display is not verification: this command
 * never sets listing status VERIFIED, riskState VERIFIED, or user.isVerified.
 *
 * With no facts, it plans one unpublished sample row and does not write unless
 * LODGIST_SEED_CONFIRM=owerri-pilot and DATABASE_URL is not production.
 *
 * Run from packages/db:
 *   node prisma/seed-owerri-home.js
 */

const fs = require("node:fs");
const path = require("node:path");

const FEE_KEYS = ["baseRent", "agency", "legal", "caution", "inspection"];
const AUTHORITY = new Set(["CONTROLS", "AUTHORIZED"]);
const AVAILABILITY = new Set(["AVAILABLE_NOW", "FROM_DATE", "NOT_AVAILABLE"]);
const RENT_PERIOD = new Set(["MONTH", "YEAR", "SEMESTER"]);
const UNPUBLISHED_EMAIL = "unpublished-owerri-seed@lodgist.invalid";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseYmd(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function feeOk(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  if (item.known === false) return item.amountNgn == null || item.amountNgn === "";
  if (item.known !== true) return false;
  const amount = typeof item.amountNgn === "number" ? item.amountNgn : Number(item.amountNgn);
  return Number.isInteger(amount) && amount >= 0 && amount <= 1_000_000_000;
}

function missingOwerriHomeFacts(input) {
  const facts = input && typeof input === "object" ? input : {};
  const missing = [];
  const landlord = facts.landlord && typeof facts.landlord === "object" ? facts.landlord : {};
  if (text(landlord.name).length < 2) missing.push("landlord.name");
  const email = text(landlord.email);
  if (!email || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push("landlord.email");
  const digits = text(landlord.phone).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) missing.push("landlord.phone");
  if (!AUTHORITY.has(landlord.authority)) missing.push("landlord.authority");
  if (typeof facts.photoPublicationAllowed !== "boolean") missing.push("photoPublicationAllowed");
  if (!AVAILABILITY.has(facts.availability)) missing.push("availability");
  else if (facts.availability === "FROM_DATE" && !parseYmd(text(facts.availableFrom))) missing.push("availableFrom");
  const location = facts.location && typeof facts.location === "object" ? facts.location : {};
  if (text(location.address).length < 2) missing.push("location.address");
  if (text(location.city).toLowerCase() !== "owerri") missing.push("location.city");
  if (text(location.state).toLowerCase() !== "imo") missing.push("location.state");
  if (text(location.lga).length < 2) missing.push("location.lga");
  if (!RENT_PERIOD.has(facts.rentPeriod)) missing.push("rentPeriod");
  const price = typeof facts.priceNgn === "number" ? facts.priceNgn : Number(facts.priceNgn);
  if (!Number.isInteger(price) || price <= 0 || price > 1_000_000_000) missing.push("priceNgn");
  const fees = facts.moveInFees && typeof facts.moveInFees === "object" ? facts.moveInFees : {};
  for (const key of FEE_KEYS) {
    if (!feeOk(fees[key])) missing.push(`moveInFees.${key}`);
  }
  if (text(facts.title).length < 2) missing.push("title");
  if (text(facts.description).length < 10) missing.push("description");
  if (facts.displayReview !== "APPROVED") missing.push("displayReview");
  return missing;
}

function unpublishedUser() {
  return {
    name: "Unpublished seed",
    email: UNPUBLISHED_EMAIL,
    phone: null,
    passwordHash: null,
    role: "LANDLORD",
    isVerified: false,
    isHNW: false,
  };
}

function unpublishedProperty() {
  return {
    address: "NOT SUPPLIED",
    city: "NOT SUPPLIED",
    state: "NOT SUPPLIED",
    lga: null,
    propertyType: null,
    bedrooms: null,
    bathrooms: null,
  };
}

function unpublishedListing() {
  return {
    title: "Unpublished seed — not a home",
    description:
      "This row is an unpublished seed. It is not a home, not for rent, not reviewed, and not verified. Landlord, photo permission, availability, location, rent period, and move-in fees were not supplied.",
    price: 0,
    currency: "NGN",
    category: "RESIDENTIAL",
    status: "ARCHIVED",
    reviewStatus: "NOT_REVIEWED",
    riskState: "UNVERIFIED",
    isFlaggedForFraud: false,
    isFeatured: false,
    totalMoveInCost: { sample: true },
    furnished: null,
    availableFrom: null,
  };
}

function feeAmount(item) {
  return item.known === true ? item.amountNgn : null;
}

function moveInCost(facts) {
  const fees = facts.moveInFees;
  const parts = FEE_KEYS.map((key) => feeAmount(fees[key])).filter((amount) => typeof amount === "number");
  return {
    base_rent: feeAmount(fees.baseRent),
    agency_fee: feeAmount(fees.agency),
    legal_fee: feeAmount(fees.legal),
    caution_fee: feeAmount(fees.caution),
    inspection_fee: feeAmount(fees.inspection),
    currency: "NGN",
    rentPeriod: facts.rentPeriod,
    total: parts.reduce((sum, amount) => sum + amount, 0),
  };
}

function photoUrls(facts) {
  if (facts.photoPublicationAllowed !== true || !Array.isArray(facts.photos)) return [];
  return facts.photos
    .filter((url) => typeof url === "string" && /^https:\/\//.test(url.trim()))
    .map((url) => url.trim());
}

function realRecords(facts) {
  const landlord = facts.landlord;
  const location = facts.location;
  const availableFrom = facts.availability === "FROM_DATE" ? parseYmd(text(facts.availableFrom)) : null;
  return {
    user: {
      name: text(landlord.name),
      email: text(landlord.email),
      phone: text(landlord.phone),
      passwordHash: null,
      role: "LANDLORD",
      isVerified: false,
      isHNW: false,
    },
    property: {
      address: text(location.address),
      city: text(location.city),
      state: text(location.state),
      lga: text(location.lga),
      propertyType: null,
      bedrooms: null,
      bathrooms: null,
    },
    listing: {
      title: text(facts.title),
      description: text(facts.description),
      price: facts.priceNgn,
      currency: "NGN",
      category: "RESIDENTIAL",
      status: "ARCHIVED",
      reviewStatus: "NOT_REVIEWED",
      riskState: "UNVERIFIED",
      isFlaggedForFraud: false,
      isFeatured: false,
      totalMoveInCost: moveInCost(facts),
      furnished: null,
      availableFrom,
    },
    images: photoUrls(facts),
  };
}

function planOwerriSeed(input) {
  const facts = input && typeof input === "object" ? input : {};
  const missing = missingOwerriHomeFacts(facts);
  const structural = missing.filter((item) => item !== "displayReview");
  if (structural.length) {
    return {
      mode: "unpublished",
      publicDiscoverable: false,
      missing,
      reason: "Required home facts are not supplied, so no public listing is created.",
      user: unpublishedUser(),
      property: unpublishedProperty(),
      listing: unpublishedListing(),
      images: [],
    };
  }
  const records = realRecords(facts);
  if (facts.availability === "NOT_AVAILABLE") {
    return {
      mode: "withheld",
      publicDiscoverable: false,
      missing,
      reason: "availability is NOT_AVAILABLE, so the home is not public inventory.",
      ...records,
    };
  }
  if (facts.displayReview !== "APPROVED") {
    return {
      mode: "withheld",
      publicDiscoverable: false,
      missing,
      reason: "displayReview is not APPROVED. The home is not public and not verified.",
      ...records,
    };
  }
  return {
    mode: "reviewed",
    publicDiscoverable: true,
    missing: [],
    reason: null,
    ...records,
    listing: {
      ...records.listing,
      status: "PENDING",
      reviewStatus: "APPROVED",
      riskState: "UNVERIFIED",
    },
  };
}

function assertHonestPlan(plan) {
  if (plan.user.isVerified === true) throw new Error("Seed must not set user.isVerified.");
  if (plan.listing.status === "VERIFIED") throw new Error("Seed must not set listing status VERIFIED.");
  if (plan.listing.riskState === "VERIFIED") throw new Error("Seed must not set riskState VERIFIED.");
  const sample = Boolean(plan.listing.totalMoveInCost && plan.listing.totalMoveInCost.sample === true);
  if (sample && plan.listing.reviewStatus === "APPROVED") {
    throw new Error("Seed must not mark a sample listing reviewed.");
  }
  if (plan.publicDiscoverable) {
    if (plan.listing.reviewStatus !== "APPROVED" || sample) {
      throw new Error("A public seed row must be a reviewed non-sample home.");
    }
  }
}

function isProductionDatabaseUrl(databaseUrl) {
  if (!databaseUrl || typeof databaseUrl !== "string") return false;
  const lowered = databaseUrl.toLowerCase();
  if (lowered.includes("railway") || lowered.includes("rlwy.net") || lowered.includes("amazonaws.com")) return true;
  if (lowered.includes("neon.tech") || lowered.includes("production")) return true;
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    return host.includes("railway") || host.endsWith("rlwy.net") || host.includes("amazonaws.com") || host.endsWith("neon.tech");
  } catch {
    return true;
  }
}

function seedWriteDecision({ confirm, databaseUrl, allowProduction, railwayEnvironment, seedTarget, plan }) {
  if (confirm !== "owerri-pilot") return { write: false, reason: "confirm" };
  if (!databaseUrl) return { write: false, reason: "missing-database-url", exitCode: 1 };
  const production = isProductionDatabaseUrl(databaseUrl) || seedTarget === "production" || railwayEnvironment === "production";
  if (production && allowProduction !== "1") return { write: false, reason: "production-refused", exitCode: 1 };
  if (production && (!plan || plan.mode !== "reviewed")) {
    return { write: false, reason: "production-requires-reviewed-facts", exitCode: 1 };
  }
  return { write: true, reason: production ? "production-reviewed" : "non-production" };
}

function formatReport(plan) {
  const lines = [
    `mode: ${plan.mode}`,
    `publicDiscoverable: ${plan.publicDiscoverable}`,
  ];
  if (plan.missing.length) {
    lines.push("missing facts:");
    for (const fact of plan.missing) lines.push(`- ${fact}`);
  } else {
    lines.push("missing facts: none");
  }
  if (plan.reason) lines.push(plan.reason);
  lines.push("This seed never sets status VERIFIED, riskState VERIFIED, or user.isVerified. Review-for-display is not verification.");
  return lines.join("\n");
}

function loadFacts(filePath) {
  const target = filePath || process.env.OWERRI_HOME_FACTS || path.join(__dirname, "seeds", "owerri-home.facts.json");
  if (!fs.existsSync(target)) return {};
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

async function applyOwerriSeed(prisma, plan) {
  assertHonestPlan(plan);
  const user = await prisma.user.upsert({
    where: { email: plan.user.email },
    create: plan.user,
    update: {
      name: plan.user.name,
      phone: plan.user.phone,
      role: plan.user.role,
    },
  });
  let property = await prisma.property.findFirst({
    where: { ownerId: user.id, address: plan.property.address, city: plan.property.city },
  });
  if (!property) {
    property = await prisma.property.create({
      data: { ...plan.property, ownerId: user.id },
    });
  }
  const listingData = {
    ...plan.listing,
    ownerId: user.id,
    propertyId: property.id,
  };
  let listing = await prisma.listing.findFirst({
    where: { ownerId: user.id, title: plan.listing.title },
  });
  if (!listing) {
    listing = await prisma.listing.create({ data: listingData });
  } else {
    listing = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        description: listingData.description,
        price: listingData.price,
        status: listingData.status,
        reviewStatus: listingData.reviewStatus,
        riskState: listingData.riskState,
        totalMoveInCost: listingData.totalMoveInCost,
        availableFrom: listingData.availableFrom,
        isFeatured: false,
        isFlaggedForFraud: false,
        propertyId: property.id,
      },
    });
  }
  for (const [index, url] of plan.images.entries()) {
    const existing = await prisma.listingImage.findFirst({ where: { listingId: listing.id, url } });
    if (existing) continue;
    await prisma.listingImage.create({
      data: {
        listingId: listing.id,
        url,
        altText: "Photo supplied with the seed facts",
        isPrimary: index === 0,
        order: index,
      },
    });
  }
  return {
    userId: user.id,
    propertyId: property.id,
    listingId: listing.id,
    publicDiscoverable: plan.publicDiscoverable,
  };
}

async function main() {
  const plan = planOwerriSeed(loadFacts());
  assertHonestPlan(plan);
  console.log(formatReport(plan));
  const decision = seedWriteDecision({
    confirm: process.env.LODGIST_SEED_CONFIRM,
    databaseUrl: process.env.DATABASE_URL || "",
    allowProduction: process.env.LODGIST_SEED_ALLOW_PRODUCTION,
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT,
    seedTarget: process.env.LODGIST_SEED_TARGET,
    plan,
  });
  if (!decision.write) {
    if (decision.reason === "confirm") {
      console.log("No database write. Set LODGIST_SEED_CONFIRM=owerri-pilot to apply this plan to a non-production database.");
      return;
    }
    if (decision.reason === "missing-database-url") console.error("DATABASE_URL is not set. No rows were written.");
    if (decision.reason === "production-refused") console.error("Refusing to seed a production database. No rows were written.");
    if (decision.reason === "production-requires-reviewed-facts") {
      console.error("Refusing to write an incomplete or unpublished home to production. No rows were written.");
    }
    process.exit(decision.exitCode || 1);
  }
  const databaseUrl = process.env.DATABASE_URL;
  const { PrismaClient } = require("@prisma/client");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const pg = require("pg");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const result = await applyOwerriSeed(prisma, plan);
    console.log(JSON.stringify({ applied: true, ...result }));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

module.exports = {
  FEE_KEYS,
  UNPUBLISHED_EMAIL,
  missingOwerriHomeFacts,
  planOwerriSeed,
  assertHonestPlan,
  isProductionDatabaseUrl,
  seedWriteDecision,
  formatReport,
  loadFacts,
  applyOwerriSeed,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
