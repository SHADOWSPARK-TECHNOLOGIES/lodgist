const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ENVELOPE_KEYS,
  evidenceEnvelope,
  crossReference,
  callTool,
  loadAmenities,
} = require("../src/index.cjs");

test("a missing observation timestamp is unknown even when retrievedAt is present", () => {
  const envelope = evidenceEnvelope({
    value: 4,
    source: "OpenStreetMap",
    provider: "overpass",
    observedAt: null,
    retrievedAt: 1_000_000,
    coverage: "500m",
    classification: "OBSERVED",
    attribution: "© OpenStreetMap",
    license: "ODbL-1.0",
  }, { now: 1_000_000, staleAfterMs: 1_000 });
  ENVELOPE_KEYS.forEach((key) => assert.equal(Object.prototype.hasOwnProperty.call(envelope, key), true));
  assert.equal(envelope.freshness, "unknown");
  assert.equal(envelope.retrievedAt, 1_000_000);
  assert.equal(envelope.coverage, "500m");
  assert.equal(envelope.coverage === envelope.freshness, false);
});

test("an old observation is stale and a recent one is fresh", () => {
  const stale = evidenceEnvelope({
    value: "rain",
    observedAt: 1_000,
    provider: "weather",
  }, { now: 50_000, staleAfterMs: 10_000 });
  const fresh = evidenceEnvelope({
    value: "rain",
    observedAt: 49_000,
    provider: "weather",
    classification: "ESTIMATED",
    confidence: 0.4,
  }, { now: 50_000, staleAfterMs: 10_000 });
  assert.equal(stale.freshness, "stale");
  assert.equal(fresh.freshness, "fresh");
  assert.equal(fresh.classification, "ESTIMATED");
  assert.equal(fresh.confidence, 0.4);
  assert.equal(evidenceEnvelope({ confidence: 2, classification: "guess" }).classification, "UNKNOWN");
  assert.equal(evidenceEnvelope({ confidence: 2 }).confidence, null);
});

test("cross-reference keeps the envelope and does not treat coverage as freshness", () => {
  const report = crossReference({
    location: { listingId: 42 },
    subjects: ["listing:42"],
    now: 10_000,
    staleAfterMs: 1_000,
    providers: [{
      id: "overpass",
      observations: [{
        subjectId: "listing:42",
        fact: "amenityCount",
        value: 2,
        observedAt: 8_000,
        retrievedAt: 10_000,
        coverage: "partial",
        source: "OpenStreetMap",
        license: "ODbL",
      }],
    }],
  });
  assert.equal(report.observations[0].freshness, "stale");
  assert.equal(report.observations[0].coverage, "partial");
  assert.equal(report.observations[0].provider, "overpass");
  assert.equal(report.freshness, "stale");
});

test("tool provenance keeps the envelope and legacy amenities stay the same shape", async () => {
  let calls = 0;
  const legacy = await loadAmenities({
    focus: { lat: 5.495, lng: 7.035, precision: "approximate", radiusM: 500 },
    env: {},
    config: { overpassUrl: "https://overpass.example/interpreter" },
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(legacy).sort(), ["items", "provenance", "status"]);
  const result = await callTool("spatial.search", { query: "nekede" }, {
    listings: [{ id: 42, title: "Flat near Nekede", public: true, property: { lga: "Owerri West" } }],
    now: 5_000,
  });
  assert.equal(result.ok, true);
  ENVELOPE_KEYS.forEach((key) => assert.equal(Object.prototype.hasOwnProperty.call(result.provenance, key), true));
  assert.equal(result.provenance.freshness, "unknown");
  assert.equal(result.provenance.retrievedAt, 5_000);
  assert.equal(result.provenance.observedAt, null);
});
