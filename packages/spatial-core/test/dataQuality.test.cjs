const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CONFIDENCE_RULES,
  buildSpatialContext,
  callTool,
  crossReference,
  dataQuality,
} = require("../src/index.cjs");

const isPublic = (listing) => listing && listing.public === true;

test("empty evidence is unknown and does not invent a confident reading", () => {
  const quality = dataQuality({});
  assert.equal(quality.freshness, "unknown");
  assert.equal(quality.completeness, "empty");
  assert.equal(quality.sourceConflicts, 0);
  assert.deepEqual(quality.confidenceRuleIds, ["freshness.unknown", "confidence.missing"]);
  assert.equal(quality.warnings[0], CONFIDENCE_RULES["freshness.unknown"]);
  assert.equal(Object.prototype.hasOwnProperty.call(quality, "score"), false);
});

test("cross-reference publishes rule ids for stale, missing, and conflicting sources", () => {
  const report = crossReference({
    location: { listingId: 42 },
    subjects: ["listing:42", "listing:7"],
    constraints: { requiredFacts: ["amenityCount", "schoolCount"] },
    now: 10_000,
    staleAfterMs: 1_000,
    providers: [
      { id: "silent", observations: [] },
      {
        id: "overpass",
        observations: [{
          subjectId: "listing:42",
          fact: "amenityCount",
          value: 2,
          observedAt: 8_000,
          confidence: 0.4,
          coverage: "partial",
        }],
      },
      {
        id: "other",
        observations: [{
          subjectId: "listing:42",
          fact: "amenityCount",
          value: 9,
          observedAt: 9_500,
          confidence: 0.6,
        }],
      },
    ],
  });
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.dataQuality.completeness, "partial");
  assert.equal(report.dataQuality.freshness, "stale");
  assert.equal(report.dataQuality.sourceConflicts, 1);
  ["freshness.stale", "completeness.silent-provider", "completeness.missing-subject", "completeness.missing-fact", "conflict.sources"].forEach((id) => {
    assert.equal(report.dataQuality.confidenceRuleIds.includes(id), true, id);
  });
  assert.equal(report.dataQuality.warnings.includes(CONFIDENCE_RULES["conflict.sources"]), true);
  assert.equal(report.observations[0].coverage, "partial");
  assert.notEqual(report.dataQuality.freshness, report.observations[0].coverage);
});

test("a complete fresh pair has no warnings and does not copy a property score", () => {
  const report = crossReference({
    now: 10_000,
    staleAfterMs: 5_000,
    providers: [{
      id: "overpass",
      observations: [{
        subjectId: "listing:3",
        fact: "category",
        value: "residential",
        observedAt: 9_000,
        confidence: 0.8,
      }],
    }],
  });
  assert.equal(report.dataQuality.completeness, "complete");
  assert.equal(report.dataQuality.freshness, "fresh");
  assert.deepEqual(report.dataQuality.confidenceRuleIds, []);
  assert.deepEqual(report.dataQuality.warnings, []);
  const listing = {
    id: 3,
    title: "Flat in Yaba",
    public: true,
    score: 91,
    property: { city: "Lagos", state: "Lagos" },
    approxLocation: { lat: 6.52, lng: 3.39, radius_m: 500 },
  };
  const context = buildSpatialContext({
    listing,
    isPublicListing: isPublic,
    providers: [],
  });
  assert.equal(context.dataQuality.completeness, "empty");
  assert.equal(JSON.stringify(context).includes("91"), false);
});

test("the spatial report tool returns the same data-quality rules", async () => {
  const result = await callTool("lodgist.spatial_report", { listingId: 42 }, {
    listings: [{
      id: 42,
      title: "Flat",
      public: true,
      property: { city: "Lagos", state: "Lagos" },
    }],
    isPublicListing: isPublic,
    providers: [],
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.dataQuality.completeness, "partial");
  assert.equal(result.data.dataQuality.confidenceRuleIds.includes("completeness.missing-subject"), true);
  assert.equal(JSON.stringify(result.data).includes("latitude"), false);
});
