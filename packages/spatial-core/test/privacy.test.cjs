const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  configureSpatialCore,
  buildPublicSpatialContext,
  adaptSpatialListing,
  stripPrivateLocationKeys,
  assertNoPrivateLocationKeys,
  cellKey,
  PRIVATE_LOCATION_KEYS,
} = require("../src/index.cjs");

configureSpatialCore({
  isPublicListing(listing) {
    if (!listing || typeof listing !== "object") return false;
    if (listing.fixture === true) return false;
    if (listing.reviewStatus !== "APPROVED") return false;
    if (listing.status !== "PENDING" && listing.status !== "VERIFIED") return false;
    return true;
  },
});

const RAW = {
  address: "12 Hidden Road",
  landmark: "by the mango tree",
  latitude: 5.497123,
  longitude: 7.033812,
};

function publicHome() {
  return {
    id: 42,
    title: "Flat near Nekede",
    status: "PENDING",
    reviewStatus: "APPROVED",
    property: {
      lga: "Owerri West",
      city: "Owerri",
      state: "Imo",
      ...RAW,
    },
    approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
    ...RAW,
  };
}

test("public spatial output strips address, landmark, latitude, and longitude", () => {
  const context = buildPublicSpatialContext(publicHome());
  const adapted = adaptSpatialListing({ listing: publicHome(), purpose: "rent", ...RAW });
  for (const value of [context, adapted]) {
    const json = JSON.stringify(value);
    assert.equal(json.includes("\"address\""), false);
    assert.equal(json.includes("\"landmark\""), false);
    assert.equal(json.includes("\"latitude\""), false);
    assert.equal(json.includes("\"longitude\""), false);
    assert.equal(json.includes("12 Hidden Road"), false);
    assert.equal(json.includes("mango tree"), false);
    assert.equal(json.includes("5.497123"), false);
    assert.equal(json.includes("7.033812"), false);
  }
  assert.equal(context.focus.lat, 5.495);
  assert.equal(context.focus.lng, 7.035);
  assert.equal(context.focus.radiusM, 500);
  assert.equal(context.focus.precision, "approximate");
});

test("spatial-core refuses an output that still carries private location keys", () => {
  for (const key of ["address", "landmark", "latitude", "longitude"]) {
    assert.ok(PRIVATE_LOCATION_KEYS.has(key));
    assert.throws(() => assertNoPrivateLocationKeys({ [key]: "secret", lat: 5.495 }), /private location field/);
  }
});

test("stripPrivateLocationKeys removes private keys and keeps public geometry", () => {
  const stripped = stripPrivateLocationKeys({
    lat: 5.495,
    lng: 7.035,
    ...RAW,
    items: [{ name: "Chemist", latitude: 1, address: "hidden", lng: 7 }],
  });
  assert.deepEqual(stripped, {
    lat: 5.495,
    lng: 7.035,
    items: [{ name: "Chemist", lng: 7 }],
  });
});

test("cache keys use the published area and never a private location field", () => {
  const key = cellKey({
    precision: "approximate",
    lat: 5.495,
    lng: 7.035,
    radiusM: 500,
    address: "12 Hidden Road",
    landmark: "by the mango tree",
    latitude: 5.497123,
    longitude: 7.033812,
  }, ["shop"]);
  assert.equal(key.includes("5.495"), true);
  assert.equal(key.includes("7.035"), true);
  assert.equal(key.includes("Hidden"), false);
  assert.equal(key.includes("mango"), false);
  assert.equal(key.includes("5.497123"), false);
  assert.equal(key.includes("latitude"), false);
  assert.equal(key.includes("address"), false);
});
