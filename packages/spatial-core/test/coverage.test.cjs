const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  INCOMPLETE_WARNING,
  UNVERIFIED_WARNING,
  assessPlaceCoverage,
  buildSpatialContext,
  callTool,
  compareListings,
  comparisonConfidence,
  createSafeguardState,
} = require("../src/index.cjs");

const BENCHMARK = path.resolve(__dirname, "../../../docs/benchmarks/nigeria-osm-2026-10-09.json");
const isPublic = (listing) => listing && listing.public === true;

function home(extra = {}) {
  return {
    id: 42,
    title: "Flat",
    category: "residential",
    public: true,
    score: 88,
    property: {
      lga: "Ikeja",
      city: "Lagos",
      state: "Lagos",
      latitude: 6.6018,
      longitude: 3.3515,
      address: "12 Hidden Road",
    },
    approxLocation: { lat: 6.6, lng: 3.35, radius_m: 500 },
    ...extra,
  };
}

test("benchmark grades stay in the planning table and Nekede is not a product claim", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/coverage.cjs"), "utf8");
  assert.equal(source.includes("lat:"), false);
  assert.equal(source.includes("6.918"), false);
  const benchmark = JSON.parse(fs.readFileSync(BENCHMARK, "utf8"));
  benchmark.points.forEach((point) => {
    const sample = assessPlaceCoverage({ title: point.label });
    if (point.coordsVerifiedAgainstOSM !== true) {
      assert.equal(sample.coverage, "UNKNOWN", point.id);
      assert.equal(sample.warnings.includes(UNVERIFIED_WARNING), true, point.id);
      assert.equal(sample.coverage === point.coverageGrade, false, point.id);
      return;
    }
    const expected = point.coverageGrade === "EMPTY" ? "POOR" : point.coverageGrade;
    assert.equal(sample.coverage, expected, point.id);
  });
  const nekede = assessPlaceCoverage({ campusId: "fpno", title: "Federal Polytechnic Nekede" });
  assert.equal(nekede.coverage, "UNKNOWN");
  assert.equal(nekede.locationStatus, "unverified");
  assert.equal(nekede.groundTruth, false);
  assert.equal(JSON.stringify(nekede).includes("5.43"), false);
});

test("partial and poor coverage warn, and good coverage does not claim a complete map", () => {
  const poor = assessPlaceCoverage({ title: "Room at IMSU" });
  assert.equal(poor.coverage, "POOR");
  assert.deepEqual(poor.warnings, [INCOMPLETE_WARNING]);
  const partial = assessPlaceCoverage({ label: "Owerri West, Owerri, Imo" });
  assert.equal(partial.coverage, "PARTIAL");
  assert.equal(partial.warnings.includes(INCOMPLETE_WARNING), true);
  const good = assessPlaceCoverage({ title: "Flat in Yaba" });
  assert.equal(good.coverage, "GOOD");
  assert.equal(good.warnings.includes(INCOMPLETE_WARNING), false);
  assert.match(good.analystNote, /not proof it is absent/);
  assert.equal(assessPlaceCoverage({ title: "Somewhere else" }).coverage, "UNKNOWN");
});

test("nearby keeps returned places and does not fill a poor or unverified area", async () => {
  const poor = await callTool("lodgist.nearby_amenities", { listingId: 42 }, {
    listings: [home({ title: "Hostel at IMSU", property: { lga: "Owerri", city: "Owerri", state: "Imo" } })],
    isPublicListing: isPublic,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: [{ id: "overpass", status: "cleared" }],
    lookup: async () => [{ address: "1.1.1.1", family: 4 }],
    safeguardState: createSafeguardState(),
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ elements: [] }) }),
  });
  assert.equal(poor.ok, true);
  assert.deepEqual(poor.data.items, []);
  assert.equal(poor.data.coverage, "POOR");
  assert.equal(poor.data.warnings[0], INCOMPLETE_WARNING);
  assert.equal(JSON.stringify(poor.data).includes("poiTotal"), false);

  const nekede = await callTool("spatial.nearby", { listingId: 9 }, {
    listings: [home({
      id: 9,
      title: "Flat near Nekede",
      property: { lga: "Owerri West", city: "Owerri", state: "Imo", latitude: 5.497, longitude: 7.033 },
    })],
    isPublicListing: isPublic,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: [{ id: "overpass", status: "cleared" }],
    lookup: async () => [{ address: "1.1.1.1", family: 4 }],
    safeguardState: createSafeguardState(),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [{ type: "node", id: 3, lat: 5.5, lon: 7.03, tags: { amenity: "pharmacy", name: "Only Chemist" } }],
      }),
    }),
  });
  assert.equal(nekede.data.coverage, "UNKNOWN");
  assert.equal(nekede.data.items.length, 1);
  assert.equal(nekede.data.items[0].name, "Only Chemist");
  assert.equal(JSON.stringify(nekede).includes("5.497"), false);
});

test("spatial context, report, and compare carry coverage without a property score", async () => {
  const listing = home({ id: 3, title: "Flat in Surulere", score: 91 });
  const poor = home({
    id: 4,
    title: "Room at FUTO",
    score: 70,
    property: { city: "Owerri", state: "Imo", latitude: 5.4, longitude: 6.99, address: "Hidden" },
  });
  const context = buildSpatialContext({ listing, isPublicListing: isPublic, providers: [] });
  assert.equal(context.coverageQuality, "GOOD");
  assert.equal(Object.prototype.hasOwnProperty.call(context, "score"), false);
  assert.equal(JSON.stringify(context).includes("91"), false);
  assert.equal(Array.isArray(context.coverage), true);

  const nekedeContext = buildSpatialContext({
    listing: home({ title: "Flat near Nekede", score: 40 }),
    campusId: "fpno",
    isPublicListing: isPublic,
  });
  assert.equal(nekedeContext.coverageQuality, "UNKNOWN");
  assert.equal(nekedeContext.warnings[0], UNVERIFIED_WARNING);

  const report = await callTool("lodgist.spatial_report", { listingId: 4 }, {
    listings: [poor],
    isPublicListing: isPublic,
  });
  assert.equal(report.ok, true);
  assert.equal(report.data.coverageQuality, "POOR");
  assert.equal(report.data.warnings[0], INCOMPLETE_WARNING);
  assert.equal(Array.isArray(report.data.coverage), true);
  assert.equal(JSON.stringify(report.data).includes("70"), false);

  const compared = compareListings({
    listingIds: [3, 4],
    listings: [listing, poor],
    isPublicListing: isPublic,
  });
  assert.equal(compared.coverage, "POOR");
  assert.equal(compared.comparisonConfidence, "low");
  assert.equal(comparisonConfidence(["GOOD", "GOOD"]), "supported");
  assert.equal(comparisonConfidence(["GOOD", "PARTIAL"]), "limited");
  assert.equal(comparisonConfidence(["GOOD", "UNKNOWN"]), "unknown");
  assert.equal(JSON.stringify(compared).includes("91"), false);
  assert.equal(JSON.stringify(compared).includes("70"), false);

  const analyst = await callTool("lodgist.compare_properties", { listingIds: [3, 4] }, {
    listings: [listing, poor],
    isPublicListing: isPublic,
  });
  assert.equal(analyst.data.comparisonConfidence, "low");
  assert.match(analyst.data.analystNote, /incomplete in this area/);
  assert.equal(JSON.stringify(analyst.data).includes("latitude"), false);
});
