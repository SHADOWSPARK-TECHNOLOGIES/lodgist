const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  crossReference,
  relateListingToCampus,
  compareListings,
  mapLabLayer,
  spatialLabDrift,
  buildSpatialContext,
  TRANSIT_POLICY,
  CANONICAL_CATEGORIES,
  AMENITY_CATEGORIES,
} = require("../src/index.cjs");

const isPublic = (listing) => Boolean(listing && listing.public === true);

function home(extra = {}) {
  return {
    id: 42,
    title: "Flat near Nekede",
    category: "residential",
    public: true,
    property: {
      lga: "Owerri West",
      city: "Owerri",
      state: "Imo",
      latitude: 5.497123,
      longitude: 7.033812,
      address: "12 Hidden Road",
      landmark: "Secret junction",
    },
    approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
    ...extra,
  };
}

test("canonical categories are Lodgist's and transit stays off", () => {
  assert.deepEqual(CANONICAL_CATEGORIES, AMENITY_CATEGORIES);
  assert.equal(mapLabLayer("hospitals"), "clinic");
  assert.equal(mapLabLayer("markets"), "shop");
  assert.equal(mapLabLayer("pharmacies"), "pharmacy");
  assert.equal(mapLabLayer("schools"), null);
  assert.equal(mapLabLayer("roads"), null);
  assert.equal(mapLabLayer("transit"), null);
  assert.equal(TRANSIT_POLICY.enabled, false);
  assert.equal(TRANSIT_POLICY.status, "undecided");
});

test("conflicts stay visible and a missing timestamp is unknown", () => {
  const report = crossReference({
    location: { listingId: 42, campusId: "fpno" },
    subjects: ["listing:42", "listing:99"],
    constraints: { requiredFacts: ["amenityCount", "powerHours"] },
    now: 1_000_000,
    staleAfterMs: 1_000,
    providers: [
      {
        id: "overpass",
        observations: [{
          subjectId: "listing:42",
          fact: "amenityCount",
          value: 3,
          observedAt: 999_500,
          confidence: 0.7,
          classification: "OBSERVED",
          coverage: "500m",
          source: "OpenStreetMap",
          license: "ODbL",
        }],
      },
      {
        id: "second-places",
        observations: [{
          subjectId: "listing:42",
          fact: "amenityCount",
          value: 5,
          observedAt: null,
          classification: "ESTIMATED",
          coverage: "500m",
          source: "Estimate",
          license: "unknown",
        }],
      },
      { id: "silent-env", observations: [] },
    ],
  });
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.agreements.length, 0);
  assert.deepEqual(report.conflicts[0].values.map((item) => item.value), [3, 5]);
  assert.equal(report.observations[1].freshness, "unknown");
  assert.equal(report.observations[1].coverage, "500m");
  assert.equal(report.freshness, "unknown");
  assert.equal(report.missing.some((item) => item.reason === "provider-silent"), true);
  assert.equal(report.missing.some((item) => item.subjectId === "listing:99"), true);
  assert.equal(report.missing.some((item) => item.fact === "powerHours"), true);
  assert.equal(report.coverage[0], "500m");
});

test("agreeing sources are not collapsed into a single provider", () => {
  const report = crossReference({
    now: 5_000,
    staleAfterMs: 10_000,
    providers: [
      { id: "a", observations: [{ subjectId: "1", fact: "campus", value: "fpno", observedAt: 4_000, classification: "OBSERVED", coverage: "campus" }] },
      { id: "b", observations: [{ subjectId: "1", fact: "campus", value: "fpno", observedAt: 4_000, classification: "OBSERVED", coverage: "campus" }] },
    ],
  });
  assert.equal(report.conflicts.length, 0);
  assert.equal(report.agreements.length, 1);
  assert.equal(report.agreements[0].values.length, 2);
  assert.equal(report.freshness, "fresh");
  assert.notEqual(report.freshness, report.coverage[0]);
});

test("listing-campus relation uses ids only and never pairs a straight line with a time", () => {
  const related = relateListingToCampus({
    listingId: 42,
    campusId: "fpno",
    listings: [home()],
    isPublicListing: isPublic,
  });
  assert.equal(related.status, "related");
  assert.match(related.straightLineLabel, /straight-line/);
  assert.equal(related.travelTime, null);
  assert.equal(/min|hour/.test(JSON.stringify(related)), false);
  assert.equal(JSON.stringify(related).includes("12 Hidden Road"), false);
  assert.equal(JSON.stringify(related).includes("5.497123"), false);
  assert.throws(
    () => relateListingToCampus({ listingId: 42, campusId: "fpno", lat: 5.4, lng: 7 }),
    /refuses raw coordinates/,
  );
});

test("compare uses listing ids and drops private location fields", () => {
  const other = home({ id: 7, title: "Other flat", category: "commercial" });
  const report = compareListings({
    listingIds: [42, 7],
    listings: [home(), other],
    isPublicListing: isPublic,
  });
  assert.equal(report.comparisons.find((item) => item.fact === "category").agreement, false);
  assert.equal(JSON.stringify(report).includes("latitude"), false);
  assert.equal(JSON.stringify(report).includes("Secret junction"), false);
  assert.throws(() => compareListings({ listingIds: [42], listings: [] }), /two listing ids/);
});

test("spatial context keeps the snapped area and refuses exact coordinates", () => {
  const context = buildSpatialContext({
    listing: home(),
    campusId: "fpno",
    isPublicListing: isPublic,
    providers: [],
  });
  assert.equal(context.locationState, "approximate");
  assert.equal(context.approxLocation.lat, 5.495);
  assert.equal(context.approxLocation.lng, 7.035);
  assert.equal(context.travelTime, null);
  assert.match(context.straightLineLabel, /straight-line/);
  assert.equal(JSON.stringify(context).includes("5.497123"), false);
  assert.equal(JSON.stringify(context).includes("12 Hidden Road"), false);
  assert.equal(buildSpatialContext({ listing: home({ public: false }), isPublicListing: isPublic }), null);
});

test("drift check reports Spatial Lab contract differences and is quiet when they match", () => {
  const quiet = spatialLabDrift();
  assert.deepEqual(quiet.differences, []);
  assert.equal(quiet.transit.enabled, false);
  const noisy = spatialLabDrift({
    revision: "different",
    allowedLayers: ["hospitals"],
    bannedLayers: SPATIAL_LAB_BANNED(),
    amenityCategories: ["shop", "pharmacy", "clinic", "transport"],
    providerIds: ["overpass", "tiles", "geocoder", "imagery", "weather", "traffic"],
    transit: "allowed",
  });
  assert.equal(noisy.differences.some((item) => item.field === "allowedLayers"), true);
  assert.equal(noisy.differences.some((item) => item.field === "transit"), true);
  assert.equal(noisy.differences.some((item) => item.field === "revision"), true);
});

function SPATIAL_LAB_BANNED() {
  return ["flights", "military", "vessels", "satellites", "cctv", "alpr", "radio", "cables", "firms", "earthquakes"];
}
