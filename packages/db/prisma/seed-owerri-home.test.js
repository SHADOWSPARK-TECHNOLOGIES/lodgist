const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  missingOwerriHomeFacts,
  planOwerriSeed,
  assertHonestPlan,
  isProductionDatabaseUrl,
  seedWriteDecision,
  loadFacts,
} = require("./seed-owerri-home");

const REQUIRED = [
  "landlord.name",
  "landlord.email",
  "landlord.phone",
  "landlord.authority",
  "photoPublicationAllowed",
  "availability",
  "location.address",
  "location.city",
  "location.state",
  "location.lga",
  "rentPeriod",
  "priceNgn",
  "moveInFees.baseRent",
  "moveInFees.agency",
  "moveInFees.legal",
  "moveInFees.caution",
  "moveInFees.inspection",
  "title",
  "description",
  "displayReview",
];

function completeFacts(extra = {}) {
  return {
    landlord: {
      name: "Test Landlord",
      email: "test-landlord@example.com",
      phone: "+2348012345678",
      authority: "CONTROLS",
    },
    photoPublicationAllowed: false,
    photos: [],
    availability: "AVAILABLE_NOW",
    location: {
      address: "1 Test Street",
      city: "Owerri",
      state: "Imo",
      lga: "Owerri West",
    },
    rentPeriod: "YEAR",
    priceNgn: 450000,
    moveInFees: {
      baseRent: { known: true, amountNgn: 450000 },
      agency: { known: false },
      legal: { known: false },
      caution: { known: true, amountNgn: 50000 },
      inspection: { known: false },
    },
    title: "Two bedroom near the campus",
    description: "Founder-supplied description of one real home.",
    displayReview: "APPROVED",
    ...extra,
  };
}

test("the committed facts file is empty and the plan is not public", () => {
  const facts = loadFacts();
  const missing = missingOwerriHomeFacts(facts);
  assert.deepEqual(missing, REQUIRED);
  const plan = planOwerriSeed(facts);
  assertHonestPlan(plan);
  assert.equal(plan.mode, "unpublished");
  assert.equal(plan.publicDiscoverable, false);
  assert.equal(plan.listing.reviewStatus, "NOT_REVIEWED");
  assert.equal(plan.listing.status, "ARCHIVED");
  assert.notEqual(plan.listing.status, "VERIFIED");
  assert.equal(plan.listing.riskState, "UNVERIFIED");
  assert.equal(plan.user.isVerified, false);
  assert.equal(plan.listing.totalMoveInCost.sample, true);
  assert.equal(plan.listing.totalMoveInCost.total, undefined);
  assert.equal(plan.property.city, "NOT SUPPLIED");
  assert.equal(JSON.stringify(plan).includes("Ikenegbu"), false);
  assert.equal(JSON.stringify(plan).includes("Nekede"), false);
  assert.equal(JSON.stringify(plan).includes("Lekki"), false);
});

test("a complete reviewed plan stays unverified and is not a sample", () => {
  const plan = planOwerriSeed(completeFacts());
  assertHonestPlan(plan);
  assert.equal(plan.mode, "reviewed");
  assert.equal(plan.publicDiscoverable, true);
  assert.deepEqual(plan.missing, []);
  assert.equal(plan.listing.reviewStatus, "APPROVED");
  assert.equal(plan.listing.status, "PENDING");
  assert.equal(plan.listing.riskState, "UNVERIFIED");
  assert.equal(plan.user.isVerified, false);
  assert.equal(plan.listing.totalMoveInCost.sample, undefined);
  assert.equal(plan.listing.totalMoveInCost.rentPeriod, "YEAR");
  assert.equal(plan.listing.totalMoveInCost.base_rent, 450000);
  assert.equal(plan.listing.totalMoveInCost.agency_fee, null);
  assert.equal(plan.images.length, 0);
});

test("complete facts without a display review are stored as not public", () => {
  const plan = planOwerriSeed(completeFacts({ displayReview: null }));
  assertHonestPlan(plan);
  assert.equal(plan.mode, "withheld");
  assert.equal(plan.publicDiscoverable, false);
  assert.equal(plan.listing.reviewStatus, "NOT_REVIEWED");
  assert.equal(plan.listing.status, "ARCHIVED");
  assert.equal(plan.listing.totalMoveInCost.sample, undefined);
  assert.ok(plan.missing.includes("displayReview"));
});

test("a sample-shaped plan cannot be marked verified", () => {
  const plan = planOwerriSeed({});
  plan.listing.status = "VERIFIED";
  assert.throws(() => assertHonestPlan(plan), /VERIFIED/);
});

test("production database URLs are refused", () => {
  assert.equal(isProductionDatabaseUrl("postgresql://u:p@localhost:5432/lodgist"), false);
  assert.equal(isProductionDatabaseUrl("postgresql://u:p@lodgist-api-production.up.railway.app:5432/railway"), true);
  assert.equal(isProductionDatabaseUrl("postgresql://u:p@ep-example.neon.tech/neondb"), true);
  assert.equal(isProductionDatabaseUrl(""), false);
  const local = planOwerriSeed({});
  assert.deepEqual(
    seedWriteDecision({ confirm: "owerri-pilot", databaseUrl: "postgresql://u:p@localhost:5432/lodgist", plan: local }),
    { write: true, reason: "non-production" },
  );
  assert.equal(
    seedWriteDecision({
      confirm: "owerri-pilot",
      databaseUrl: "postgresql://u:p@lodgist-api-production.up.railway.app:5432/railway",
      plan: local,
    }).reason,
    "production-refused",
  );
  const reviewed = planOwerriSeed(completeFacts());
  assert.equal(
    seedWriteDecision({
      confirm: "owerri-pilot",
      databaseUrl: "postgresql://u:p@lodgist-api-production.up.railway.app:5432/railway",
      allowProduction: "1",
      plan: local,
    }).reason,
    "production-requires-reviewed-facts",
  );
  assert.equal(
    seedWriteDecision({
      confirm: "owerri-pilot",
      databaseUrl: "postgresql://u:p@lodgist-api-production.up.railway.app:5432/railway",
      allowProduction: "1",
      plan: reviewed,
    }).reason,
    "production-reviewed",
  );
});
