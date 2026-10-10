const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/index.cjs");

const NOW = Date.parse("2026-10-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const KEYS = ["coverage", "freshness", "confidence", "completeness", "conflicts", "warnings", "ruleIds", "computedAt"];

function env(observedAt, confidence) {
  return core.evidenceEnvelope({ value: 1, provider: "p", observedAt, confidence, classification: "OBSERVED" }, { now: NOW });
}

test("DataQuality has the full 12B shape", () => {
  const dq = core.spatialDataQuality({ observations: [env(NOW - 1000, 0.8)], coverage: "GOOD", now: NOW });
  assert.deepEqual(Object.keys(dq).sort(), KEYS.slice().sort());
  assert.equal(dq.freshness, "FRESH");
  assert.equal(dq.coverage, "GOOD");
  assert.equal(dq.confidence, 0.8);
  assert.equal(dq.computedAt, "2026-10-10T12:00:00.000Z");
});

test("freshness FRESH/AGING/STALE/UNKNOWN", () => {
  assert.equal(core.spatialDataQuality({ observations: [env(NOW - 13 * 60 * 60 * 1000, 1)], now: NOW }).freshness, "AGING");
  assert.equal(core.spatialDataQuality({ observations: [env(NOW - 2 * DAY, 1)], now: NOW }).freshness, "STALE");
  assert.equal(core.spatialDataQuality({ observations: [env(null, 1)], now: NOW }).freshness, "UNKNOWN");
  assert.equal(core.spatialDataQuality({ now: NOW }).freshness, "UNKNOWN");
});

test("no evidence is flagged, never invented", () => {
  const dq = core.spatialDataQuality({ now: NOW });
  assert.ok(dq.ruleIds.includes("dq.no-evidence"));
  assert.equal(dq.confidence, null);
  assert.equal(dq.coverage, "UNKNOWN");
});

test("derived confidence never exceeds inputs (monotonic)", () => {
  const a = core.spatialDataQuality({ observations: [env(NOW, 0.9)], now: NOW });
  const b = core.spatialDataQuality({ observations: [env(NOW, 0.4)], now: NOW });
  const derived = core.spatialDataQuality({ observations: [env(NOW, 0.95)], inputs: [a, b], now: NOW });
  assert.equal(derived.confidence, 0.4);
  assert.ok(derived.ruleIds.includes("dq.confidence.inherited"));
});

test("coverage warnings describe data, not neighbourhood quality", () => {
  const dq = core.spatialDataQuality({ observations: [env(NOW, 1)], coverage: "POOR", now: NOW });
  const text = dq.warnings.join(" ").toLowerCase();
  assert.ok(text.includes("may be incomplete"));
  assert.ok(!/poor (healthcare|schools|area|neighbou?rhood)/.test(text));
});

test("conflicts are counted, never collapsed", () => {
  const dq = core.spatialDataQuality({ observations: [env(NOW, 1)], conflicts: [{ field: "x" }], now: NOW });
  assert.equal(dq.conflicts, 1);
  assert.ok(dq.ruleIds.includes("dq.conflict"));
});

test("every tool result (ok and failure) carries dataQuality", async () => {
  const listing = { id: 1, title: "Room near UNILAG Yaba", public: true, approxLocation: { lat: 6.5, lng: 3.4 } };
  const ctx = { listings: [listing], isPublicListing: (l) => l.public === true, now: NOW };
  for (const name of core.listTools().map((t) => t.name)) {
    const input = name.includes("search") ? { query: "yaba" }
      : name.includes("compare") ? { listingIds: [1, 1] }
        : name.includes("navigate") || name.includes("route") || name.includes("measure") || name.includes("commute") ? { listingId: 1, campusId: "unilag" }
          : { listingId: 1 };
    const result = await core.callTool(name, input, ctx);
    assert.ok(result.dataQuality, name);
    assert.deepEqual(Object.keys(result.dataQuality).sort(), KEYS.slice().sort(), name);
  }
  const bad = await core.callTool("spatial.inspect", { listingId: 999 }, ctx);
  assert.equal(bad.ok, false);
  assert.ok(bad.dataQuality.ruleIds.includes("dq.no-evidence"));
});

test("history/anomaly/monitor results gain dataQuality via withDataQuality", () => {
  const out = core.withDataQuality({ ok: true, code: "flag_off", anomalies: [] }, { now: NOW });
  assert.equal(out.dataQuality.coverage, "UNKNOWN");
  assert.equal(out.code, "flag_off");
});

test("versioned coverage: keyed provider+capability+geography+timestamp, no national rating", () => {
  const rows = core.coverageRecords();
  assert.ok(rows.length >= 10);
  rows.forEach((row) => {
    assert.equal(row.key, [row.provider, row.capability, row.geography, row.dataTimestamp].join("|"));
    assert.notEqual(row.geography.toLowerCase(), "nigeria");
    assert.equal(row.groundTruth, false);
  });
  assert.equal(core.coverageFor({ geography: "nigeria", capability: "places" }).grade, "UNKNOWN");
  assert.equal(core.coverageFor({ geography: "yaba-unilag", capability: "places" }).grade, "GOOD");
  assert.equal(core.coverageFor({ geography: "nekede-poly", capability: "places" }).grade, "UNKNOWN");
  assert.equal(core.coverageFor({ geography: "yaba-unilag", capability: "places", at: "2026-01-01T00:00:00Z" }).grade, "UNKNOWN");
  assert.equal(core.coverageFor({ geography: "yaba-unilag", capability: "routing" }).grade, "UNKNOWN");
});
