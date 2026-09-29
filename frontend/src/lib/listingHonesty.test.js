const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  isExampleListing,
  hasTrustScore,
  isPublicInventory,
  publicInventory,
  listingBadge,
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

test("browse shows only verified listings that are not samples", () => {
  const pending = { id: 1, status: "PENDING", price: 500000 };
  const sampleVerified = { id: 2, status: "VERIFIED", totalMoveInCost: { sample: true, total: 1 } };
  const live = { id: 3, status: "VERIFIED", price: 800000 };
  assert.equal(isPublicInventory(pending), false);
  assert.equal(isPublicInventory(sampleVerified), false);
  assert.equal(isPublicInventory(live), true);
  assert.deepEqual(publicInventory([pending, sampleVerified, live, null]).map((row) => row.id), [3]);
  assert.deepEqual(publicInventory(undefined), []);
});

test("sample and unavailable badges stay distinct", () => {
  assert.equal(listingBadge({ status: "PENDING" }), "sample");
  assert.equal(listingBadge({ status: "VERIFIED", totalMoveInCost: { sample: true } }), "sample");
  assert.equal(listingBadge({ status: "REJECTED" }), "unavailable");
  assert.equal(listingBadge({ status: "VERIFIED" }), "hidden");
});
