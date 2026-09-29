const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  isExampleListing,
  hasTrustScore,
  isPublicListing,
  publicListings,
  decisionFacts,
} = require("./listingHonesty");

test("sample move-in cost is an example, not a bill", () => {
  assert.equal(isExampleListing({ totalMoveInCost: { sample: true, total: 1560000 } }), true);
  assert.equal(isExampleListing({ totalMoveInCost: { total: 1560000 } }), false);
  assert.equal(isExampleListing({}), false);
});

test("a zero trust index is not a score", () => {
  assert.equal(hasTrustScore(0), false);
  assert.equal(hasTrustScore(null), false);
  assert.equal(hasTrustScore(82), true);
});

test("default browse keeps verified homes and drops samples and pending", () => {
  const verified = { id: 1, status: "VERIFIED", riskState: "VERIFIED", price: 900000 };
  const pending = { id: 2, status: "PENDING", riskState: "UNVERIFIED", price: 500000 };
  const sample = { id: 3, status: "VERIFIED", riskState: "VERIFIED", totalMoveInCost: { sample: true, total: 1 } };
  const flagged = { id: 4, status: "VERIFIED", riskState: "FLAGGED" };
  assert.equal(isPublicListing(verified), true);
  assert.equal(isPublicListing(pending), false);
  assert.equal(isPublicListing(sample), false);
  assert.equal(isPublicListing(flagged), false);
  assert.deepEqual(publicListings([pending, sample, verified]).map((l) => l.id), [1]);
});

test("an unverified listing has no completed checks and no verification date", () => {
  const facts = decisionFacts({
    status: "PENDING",
    riskState: "UNVERIFIED",
    price: 1200000,
    totalMoveInCost: { sample: true, total: 1560000 },
  });
  assert.equal(facts.example, true);
  assert.equal(facts.verified, false);
  assert.equal(facts.annualRent, 1200000);
  assert.equal(facts.moveInTotal, 1560000);
  assert.equal(facts.completed.length, 0);
  assert.ok(facts.outstanding.includes("Physical inspection"));
  assert.match(facts.lastVerification, /not been checked/i);
});

test("a verified listing does not invent a verification date or itemised checks", () => {
  const facts = decisionFacts({ status: "VERIFIED", riskState: "VERIFIED", price: 800000 });
  assert.equal(facts.verified, true);
  assert.match(facts.lastVerification, /date is not published/i);
  assert.equal(facts.completed.length, 1);
  assert.deepEqual(facts.outstanding, ["Physical inspection before you pay"]);
});
