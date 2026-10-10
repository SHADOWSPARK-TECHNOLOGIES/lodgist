const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ANOMALY_FAMILIES,
  anomaliesEnabled,
  attachAnomalyExplanation,
  evaluateAnomalies,
} = require("../src/index.cjs");

const began = 1_000;
const now = 50_000;
const on = { env: { SPATIAL_ANOMALIES: "1" } };
const day = 24 * 60 * 60 * 1000;

function monitor(facts) {
  return {
    id: "mon-1",
    monitoringBeganAt: began,
    targetType: "listing",
    target: { listingId: 42 },
    observationType: "amenityCount",
    baseline: { facts },
  };
}

function observation(id, fact, value, observedAt, extra = {}) {
  return {
    id,
    observedAt,
    envelope: Object.assign({
      fact,
      value,
      subjectId: "listing:42",
      provider: "overpass",
      source: "OpenStreetMap",
      license: "ODbL-1.0",
      freshness: "fresh",
      classification: "OBSERVED",
      observedAt,
      retrievedAt: observedAt + 10,
      attribution: "© OpenStreetMap contributors",
    }, extra),
  };
}

function run(family, facts, rows, extra = {}) {
  return evaluateAnomalies(Object.assign({
    families: [family],
    monitor: monitor(facts),
    observations: rows,
    now,
  }, extra.input || {}), Object.assign({}, on, extra.ctx || {}));
}

test("anomalies stay off unless SPATIAL_ANOMALIES is set", () => {
  assert.equal(anomaliesEnabled({}), false);
  assert.equal(anomaliesEnabled({ SPATIAL_MONITORING: "1", SPATIAL_HISTORY: "1" }), false);
  const result = evaluateAnomalies({
    monitor: monitor({ access: "open" }),
    observations: [observation("obs-1", "access", { address: "12 Hidden Road", access: "closed" }, 40_000)],
    now,
  }, { env: { SPATIAL_MONITORING: "1", SPATIAL_HISTORY: "1" } });
  assert.equal(result.code, "flag_off");
  assert.deepEqual(result.anomalies, []);
  assert.deepEqual(result.alerts, []);
  assert.equal(JSON.stringify(result).includes("Hidden Road"), false);
});

test("anomaly evaluation is deterministic", () => {
  const rows = [
    observation("b", "amenityCount", 4, 20_000),
    observation("a", "amenityCount", 2, 10_000),
    observation("c", "amenityCount", 8, 40_000),
  ];
  const shuffled = [rows[2], rows[0], rows[1]];
  const first = run("AMENITY_CHANGE", { amenityCount: 3 }, rows);
  const second = run("AMENITY_CHANGE", { amenityCount: 3 }, shuffled);
  assert.deepEqual(first, second);
  assert.equal(first.anomalies.length, 1);
  assert.equal(first.anomalies[0].rule.statistic.method, "median_residual");
  assert.equal(first.anomalies[0].rule.statistic.median, 3);
  assert.equal(first.anomalies[0].rule.statistic.delta, 5);
  assert.deepEqual(first.alerts, []);
});

test("insufficient evidence produces no anomaly", () => {
  const missingBaseline = run("AMENITY_CHANGE", {}, [observation("obs-1", "amenityCount", 9, 40_000)]);
  assert.equal(missingBaseline.code, "insufficient_evidence");
  assert.deepEqual(missingBaseline.anomalies, []);
  assert.equal(missingBaseline.skipped[0].reason, "no_baseline");

  const missingValue = run("ACCESS_CHANGE", { access: "open" }, [
    observation("obs-1", "access", null, 40_000),
  ]);
  assert.equal(missingValue.anomalies.length, 0);
  assert.equal(missingValue.code, "insufficient_evidence");

  const unknownTime = evaluateAnomalies({
    families: ["PROVIDER_STALENESS"],
    monitor: monitor({}),
    observations: [{
      id: "undated",
      envelope: { fact: "access", value: "closed", provider: "overpass", observedAt: null, classification: "OBSERVED" },
    }],
    now,
  }, on);
  assert.equal(unknownTime.anomalies.length, 0);
  assert.equal(unknownTime.code, "insufficient_evidence");

  const before = run("ACCESS_CHANGE", { access: "open" }, [
    observation("early", "access", "closed", 500),
  ]);
  assert.equal(before.anomalies.length, 0);
  assert.equal(JSON.stringify(before).includes("closed"), false);
});

test("a range before monitoring began does not invent an anomaly", () => {
  const result = evaluateAnomalies({
    families: ["ACCESS_CHANGE"],
    monitor: monitor({ access: "open" }),
    observations: [observation("early", "access", "closed", 40_000)],
    now: 500,
  }, on);
  assert.equal(result.code, "history_unavailable_before");
  assert.equal(result.historyBeganAt, began);
  assert.deepEqual(result.anomalies, []);
  assert.equal(JSON.stringify(result).includes("closed"), false);
});

test("listing anomaly output drops exact location fields and keeps provenance", () => {
  const result = run("AMENITY_CHANGE", { amenityCount: 1 }, [
    observation("obs-1", "amenityCount", {
      count: 9,
      latitude: 5.497123,
      longitude: 7.033812,
      address: "12 Hidden Road",
      landmark: "Secret junction",
    }, 40_000),
  ]);
  const encoded = JSON.stringify(result);
  assert.equal(result.anomalies.length, 1);
  assert.equal(encoded.includes("Hidden Road"), false);
  assert.equal(encoded.includes("Secret junction"), false);
  assert.equal(encoded.includes("latitude"), false);
  assert.equal(encoded.includes("5.497123"), false);
  assert.equal(result.anomalies[0].rule.statistic.latest, 9);
  assert.equal(result.anomalies[0].provenance.source, "OpenStreetMap");
  assert.equal(result.anomalies[0].provenance.license, "ODbL-1.0");
  assert.equal(result.anomalies[0].provenance.provider, "overpass");
  assert.equal(result.anomalies[0].provenance.observedAt, 40_000);
  assert.equal(result.anomalies[0].provenance.historyBeganAt, began);
  assert.equal(result.anomalies[0].observationIds[0], "obs-1");
  assert.equal(result.provenance.observedAt, null);
  assert.equal(result.provenance.retrievedAt, now);
});

test("an explanation cannot change severity, confidence, or the decision", () => {
  let sends = 0;
  const result = run("ACCESS_CHANGE", { access: "open" }, [
    observation("obs-1", "access", "closed", 40_000),
  ], {
    ctx: {
      send: () => { sends += 1; },
      explain: () => ({
        explanation: "Access is described as closed.",
        severity: "low",
        confidence: 0.01,
        anomalies: [],
        triggered: false,
      }),
    },
  });
  assert.equal(sends, 0);
  assert.equal(result.anomalies.length, 1);
  assert.equal(result.anomalies[0].severity, "high");
  assert.equal(result.anomalies[0].confidence, 0.8);
  assert.equal(result.anomalies[0].explanation, "Access is described as closed.");
  assert.equal(result.decidedBy, "rule");
  assert.deepEqual(result.alerts, []);
  const overridden = attachAnomalyExplanation(result, { explanation: "Again.", severity: "low", anomalies: [] });
  assert.equal(overridden.anomalies[0].severity, "high");
  assert.equal(overridden.anomalies[0].confidence, 0.8);
  assert.equal(overridden.explanation, "Again.");
  assert.deepEqual(overridden.alerts, []);
});

test("each anomaly family has a deterministic rule", () => {
  assert.deepEqual(ANOMALY_FAMILIES.slice().sort(), [
    "ACCESS_CHANGE",
    "AMENITY_CHANGE",
    "ENVIRONMENT_EVENT",
    "FLOOD_RISK_CHANGE",
    "LISTING_LOCATION_CONFLICT",
    "PROVIDER_STALENESS",
    "SOURCE_CONFLICT",
    "TRAFFIC_DISRUPTION",
    "TRANSIT_CHANGE",
    "VERIFICATION_CHANGE",
  ].sort());

  const cases = [
    ["ACCESS_CHANGE", { access: "open" }, [observation("obs-access", "access", "closed", 40_000)], "access_state_changed", "high"],
    ["FLOOD_RISK_CHANGE", { floodRisk: 0.1 }, [observation("obs-flood", "floodRisk", 0.5, 40_000)], "flood_risk_delta", "medium"],
    ["TRAFFIC_DISRUPTION", { trafficDelayMin: 5 }, [observation("obs-traffic", "trafficDelayMin", 40, 40_000)], "traffic_delay_delta", "high"],
    ["TRANSIT_CHANGE", { transitStatus: "normal" }, [observation("obs-transit", "transitStatus", "suspended", 40_000)], "transit_status_changed", "high"],
    ["AMENITY_CHANGE", { amenityCount: 3 }, [observation("obs-amenity", "amenityCount", 8, 40_000)], "amenity_count_delta", "high"],
    ["ENVIRONMENT_EVENT", { environmentEvent: null }, [observation("obs-env", "environmentEvent", "flood-watch", 40_000)], "environment_event_present", "high"],
    ["VERIFICATION_CHANGE", { verification: "verified" }, [observation("obs-verify", "verification", "rejected", 40_000)], "verification_state_changed", "high"],
  ];
  cases.forEach(([family, facts, rows, rule, severity]) => {
    const result = run(family, facts, rows);
    assert.equal(result.anomalies.length, 1, family);
    assert.equal(result.anomalies[0].family, family);
    assert.equal(result.anomalies[0].rule.name, rule);
    assert.equal(result.anomalies[0].severity, severity);
    assert.equal(result.anomalies[0].triggeredAt, 40_000);
    assert.equal(typeof result.anomalies[0].confidence, "number");
    assert.equal(result.anomalies[0].provider, "overpass");
    assert.deepEqual(result.alerts, []);
  });

  const location = evaluateAnomalies({
    families: ["LISTING_LOCATION_CONFLICT"],
    monitor: monitor({}),
    now,
    observations: [
      observation("loc-a", "areaLabel", "Nekede", 30_000, { provider: "overpass" }),
      observation("loc-b", "areaLabel", "Ihiagwa", 40_000, { provider: "places" }),
    ],
  }, on);
  assert.equal(location.anomalies.length, 1);
  assert.equal(location.anomalies[0].family, "LISTING_LOCATION_CONFLICT");
  assert.equal(location.anomalies[0].rule.name, "listing_location_conflict");
  assert.equal(location.anomalies[0].rule.threshold.minProviders, 2);
  assert.deepEqual(location.anomalies[0].observationIds, ["loc-a", "loc-b"]);
  assert.equal(location.anomalies[0].severity, "high");

  const source = evaluateAnomalies({
    families: ["SOURCE_CONFLICT"],
    monitor: monitor({ amenityCount: 3 }),
    now,
    observations: [
      observation("src-a", "amenityCount", 3, 30_000, { provider: "overpass" }),
      observation("src-b", "amenityCount", 9, 40_000, { provider: "places" }),
    ],
  }, on);
  assert.equal(source.anomalies.length, 1);
  assert.equal(source.anomalies[0].family, "SOURCE_CONFLICT");
  assert.equal(source.anomalies[0].rule.name, "source_value_conflict");
  assert.deepEqual(source.anomalies[0].observationIds, ["src-a", "src-b"]);

  const staleAt = 2_000;
  const stale = evaluateAnomalies({
    families: ["PROVIDER_STALENESS"],
    monitor: monitor({}),
    now: staleAt + day + 5,
    observations: [
      observation("stale-1", "amenityCount", 4, staleAt, { freshness: "fresh" }),
    ],
  }, on);
  assert.equal(stale.anomalies.length, 1);
  assert.equal(stale.anomalies[0].family, "PROVIDER_STALENESS");
  assert.equal(stale.anomalies[0].rule.name, "provider_stale");
  assert.equal(stale.anomalies[0].rule.threshold.staleAfterMs, day);
  assert.equal(stale.anomalies[0].provider, "overpass");
  assert.equal(stale.anomalies[0].confidence, 0.5);
  assert.equal(stale.anomalies[0].evidence.freshness, "stale");

  const labeledStale = evaluateAnomalies({
    families: ["PROVIDER_STALENESS"],
    monitor: monitor({}),
    now,
    observations: [observation("fresh-1", "amenityCount", 4, 40_000, { freshness: "stale" })],
  }, on);
  assert.equal(labeledStale.anomalies.length, 0);
});
