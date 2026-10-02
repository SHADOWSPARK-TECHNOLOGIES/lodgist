const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  isExampleListing,
  hasTrustScore,
  isEvidenceVerified,
  isLodgistReviewed,
  isPublicListing,
  reviewLabel,
  verificationLabel,
  sourceLabel,
  canRequestViewing,
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

test("default browse keeps eligible pending and verified homes and drops samples", () => {
  const verified = { id: 1, status: "VERIFIED", riskState: "VERIFIED", price: 900000 };
  const pending = { id: 2, status: "PENDING", riskState: "UNVERIFIED", price: 500000 };
  const sample = { id: 3, status: "PENDING", riskState: "UNVERIFIED", totalMoveInCost: { sample: true, total: 1 } };
  const flagged = { id: 4, status: "VERIFIED", riskState: "FLAGGED" };
  const suspended = { id: 5, status: "PENDING", riskState: "SUSPENDED" };
  const rejected = { id: 6, status: "REJECTED", riskState: "UNVERIFIED" };
  const fraud = { id: 7, status: "PENDING", riskState: "UNVERIFIED", isFlaggedForFraud: true };
  assert.equal(isPublicListing(verified), true);
  assert.equal(isPublicListing(pending), true);
  assert.equal(isEvidenceVerified(pending), false);
  assert.equal(isEvidenceVerified(verified), false);
  assert.equal(reviewLabel(pending), "Not reviewed by Lodgist");
  assert.equal(reviewLabel(verified), "Not reviewed by Lodgist");
  assert.equal(isPublicListing(sample), false);
  assert.equal(isPublicListing(flagged), false);
  assert.equal(isPublicListing(suspended), false);
  assert.equal(isPublicListing(rejected), false);
  assert.equal(isPublicListing(fraud), false);
  assert.equal(verificationLabel(pending), "Not verified by Lodgist");
  assert.equal(sourceLabel(pending), "Direct submission");
  assert.equal(canRequestViewing(pending), false);
  assert.equal(canRequestViewing(verified), true);
  assert.equal(canRequestViewing(sample), false);
  assert.deepEqual(publicListings([pending, sample, verified, flagged]).map((l) => l.id), [2, 1]);
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

test("a pending non-sample listing is labelled not verified and cannot request a viewing", () => {
  const facts = decisionFacts({ status: "PENDING", riskState: "UNVERIFIED", price: 500000 });
  assert.equal(facts.example, false);
  assert.equal(facts.verified, false);
  assert.match(facts.lastVerification, /Not verified by Lodgist/);
  assert.equal(facts.completed.length, 0);
  assert.equal(canRequestViewing({ status: "PENDING", riskState: "UNVERIFIED" }), false);
});

test("Lodgist review and payment do not complete verification checks", () => {
  const listing = {
    status: "VERIFIED",
    riskState: "VERIFIED",
    reviewStatus: "APPROVED",
    paid: true,
    price: 800000,
  };
  assert.equal(isLodgistReviewed(listing), true);
  assert.equal(reviewLabel(listing), "Lodgist-reviewed");
  assert.equal(isEvidenceVerified(listing), false);
  assert.equal(verificationLabel(listing), "Not verified by Lodgist");
  const facts = decisionFacts(listing);
  assert.equal(facts.verified, false);
  assert.equal(facts.completed.length, 0);
  assert.match(facts.lastVerification, /Not verified by Lodgist/);
  assert.equal(canRequestViewing(listing), true);
});
