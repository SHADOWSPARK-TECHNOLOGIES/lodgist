const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isExampleListing, hasTrustScore } = require("./listingHonesty");

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
