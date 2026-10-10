const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ENVELOPE_KEYS,
  assertSchedule,
  beginMonitor,
  evaluateConditions,
  monitoringEnabled,
  providerRegistry,
  decideNotification,
  runMonitor,
} = require("../src/index.cjs");

const cleared = {
  id: "overpass",
  status: "cleared",
  commercialUse: "APPROVED_WITH_ATTRIBUTION",
  rateLimits: { perMinuteDefault: 30 },
  freshnessPolicy: { staleAfterMs: 1000, minIntervalMs: 5000 },
};

test("a schedule faster than the provider floor is rejected", () => {
  const tooFast = assertSchedule({
    providers: ["overpass"],
    schedule: { intervalMs: 2000 },
  }, [cleared]);
  assert.equal(tooFast.ok, false);
  assert.equal(tooFast.code, "schedule_too_fast");
  assert.equal(tooFast.minimumIntervalMs, 5000);
  const allowed = assertSchedule({
    providers: ["overpass"],
    schedule: { intervalMs: 5000 },
  }, [cleared]);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.minimumIntervalMs, 5000);
});

test("the default registry rate limit is a finite floor", () => {
  const overpass = providerRegistry().find((row) => row.id === "overpass");
  const decision = assertSchedule({
    providers: ["overpass"],
    schedule: { intervalMs: 1000 },
  });
  assert.equal(decision.code, "schedule_too_fast");
  assert.equal(decision.minimumIntervalMs, Math.ceil(60000 / overpass.rateLimits.perMinuteDefault));
});

test("an unlimited provider schedule is refused", () => {
  const decision = assertSchedule({
    providers: ["open"],
    schedule: { intervalMs: 60000 },
  }, [{ id: "open", status: "cleared", rateLimits: {}, freshnessPolicy: {} }]);
  assert.equal(decision.code, "schedule_too_fast");
  assert.equal(decision.reason, "no_rate_limit");
});

test("condition evaluation is deterministic and does not invent a baseline", () => {
  const conditions = [{ op: "gt" }, { op: "changed" }, { op: "eq" }];
  const first = evaluateConditions({ value: 3 }, 5, conditions);
  const second = evaluateConditions({ value: 3 }, 5, conditions);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((item) => item.met), [true, true, false]);
  const missing = evaluateConditions(null, 5, [{ op: "gt" }]);
  assert.equal(missing[0].met, false);
  assert.equal(missing[0].reason, "no_baseline");
  assert.equal(evaluateConditions({ value: 5 }, 5, [{ op: "changed" }])[0].met, false);
});

test("monitoring cannot begin with a past observation", () => {
  assert.equal(monitoringEnabled({}), false);
  assert.equal(monitoringEnabled({ SPATIAL_MONITORING: "1" }), true);
  const rejected = beginMonitor({
    id: "mon-1",
    targetType: "listing",
    target: { listingId: 42 },
    providers: ["overpass"],
    schedule: { intervalMs: 5000 },
    registry: [cleared],
    observations: [{ value: 1, observedAt: 1 }],
  }, 10_000);
  assert.equal(rejected.code, "fabricated_history");
  const started = beginMonitor({
    id: "mon-1",
    targetType: "listing",
    target: { listingId: 42 },
    providers: ["overpass"],
    schedule: { intervalMs: 5000 },
    registry: [cleared],
  }, 10_000);
  assert.equal(started.ok, true);
  assert.equal(started.monitor.monitoringBeganAt, 10_000);
  assert.equal(started.monitor.lastObservedAt, null);
  assert.equal(started.monitor.baseline, null);
});

function liveMonitor(extra = {}) {
  return Object.assign({
    id: "mon-1",
    targetType: "listing",
    target: { listingId: 42 },
    providers: ["overpass"],
    observationType: "amenityCount",
    baseline: { value: 3 },
    conditions: [{ op: "gt" }],
    schedule: { intervalMs: 5000 },
    lastObservedAt: null,
    monitoringBeganAt: 1_000,
    state: "idle",
  }, extra);
}

const registry = [{
  id: "overpass",
  status: "cleared",
  commercialUse: "APPROVED_WITH_ATTRIBUTION",
  rateLimits: { perMinuteDefault: 30 },
  freshnessPolicy: { staleAfterMs: 1_000, minIntervalMs: 5_000 },
  attribution: "© OpenStreetMap contributors",
}];

const listing = {
  id: 42,
  public: true,
  approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
  property: { latitude: 5.497123, longitude: 7.033812, address: "12 Hidden Road" },
};

test("flag off is a no-op and does not echo a reading", () => {
  const result = runMonitor(liveMonitor(), 20_000, {
    env: {},
    registry,
    listing,
    readings: [{ provider: "overpass", value: { secret: 9, address: "12 Hidden Road" }, observedAt: 19_000 }],
  });
  assert.equal(result.code, "flag_off");
  assert.deepEqual(result.observations, []);
  assert.equal(JSON.stringify(result).includes("Hidden Road"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("a stale provider stays stale and keeps provenance", () => {
  const result = runMonitor(liveMonitor(), 20_000, {
    env: { SPATIAL_MONITORING: "1" },
    registry,
    listing,
    readings: [{
      provider: "overpass",
      value: 4,
      observedAt: 1_000,
      retrievedAt: 20_000,
      source: "OpenStreetMap",
      license: "ODbL-1.0",
      attribution: "© OpenStreetMap contributors",
      classification: "OBSERVED",
    }],
  });
  assert.equal(result.code, "observed");
  const envelope = result.observations[0];
  ENVELOPE_KEYS.forEach((key) => assert.equal(Object.prototype.hasOwnProperty.call(envelope, key), true, key));
  assert.equal(envelope.freshness, "stale");
  assert.equal(envelope.observedAt, 1_000);
  assert.equal(envelope.retrievedAt, 20_000);
  assert.equal(envelope.provider, "overpass");
  assert.equal(envelope.license, "ODbL-1.0");
  assert.equal(result.provenance.monitoringBeganAt, 1_000);
  assert.equal(result.provenance.observedAt, null);
  assert.equal(result.providerResults[0].code, "stale");
  assert.deepEqual(result.evaluated[0].results[0], { index: 0, op: "gt", met: true, reason: "compared" });
  const again = runMonitor(liveMonitor(), 20_000, {
    env: { SPATIAL_MONITORING: "1" },
    registry,
    listing,
    readings: [{
      provider: "overpass",
      value: 4,
      observedAt: 1_000,
      source: "OpenStreetMap",
      license: "ODbL-1.0",
      attribution: "© OpenStreetMap contributors",
      classification: "OBSERVED",
    }],
  });
  assert.deepEqual(again.evaluated, result.evaluated);
  assert.deepEqual(again.observations, result.observations);
});

test("a missing provider key does not invent a value", () => {
  const places = [{
    id: "places",
    status: "cleared",
    commercialUse: "APPROVED_COMMERCIAL",
    authentication: { required: true, env: "PLACES_API_KEY" },
    rateLimits: { perMinuteDefault: 30 },
    freshnessPolicy: { minIntervalMs: 5_000, staleAfterMs: 1_000 },
  }];
  const result = runMonitor(liveMonitor({ providers: ["places"] }), 20_000, {
    env: { SPATIAL_MONITORING: "1" },
    production: true,
    registry: places,
    listing,
    readings: [{ provider: "places", value: 99, observedAt: 19_000, source: "secret-feed" }],
  });
  assert.equal(result.providerResults[0].code, "missing_api_key");
  assert.equal(result.observations[0].value, null);
  assert.equal(result.observations[0].classification, "UNKNOWN");
  assert.equal(JSON.stringify(result).includes("secret-feed"), false);
  assert.equal(JSON.stringify(result).includes("99"), false);
});

test("a listing target keeps the approximate area and drops exact fields", () => {
  const result = runMonitor(liveMonitor(), 20_000, {
    env: { SPATIAL_MONITORING: "1" },
    registry,
    listing,
    readings: [{
      provider: "overpass",
      value: { count: 4, latitude: 5.497123, longitude: 7.033812, address: "12 Hidden Road", landmark: "Secret junction" },
      observedAt: 19_000,
      source: "OpenStreetMap",
      license: "ODbL-1.0",
    }],
  });
  const encoded = JSON.stringify(result);
  assert.equal(encoded.includes("12 Hidden Road"), false);
  assert.equal(encoded.includes("Secret junction"), false);
  assert.equal(encoded.includes("latitude"), false);
  assert.equal(encoded.includes("5.497123"), false);
  assert.equal(result.observations[0].value.count, 4);
  assert.equal(result.observations[0].value.area.lat, 5.495);
  assert.equal(result.observations[0].value.privacy, "APPROXIMATE");
  const hidden = runMonitor(liveMonitor(), 20_000, {
    env: { SPATIAL_MONITORING: "1" },
    registry,
    listing: { id: 42, public: false, approxLocation: listing.approxLocation },
    readings: [{ provider: "overpass", value: { count: 4, address: "12 Hidden Road" }, observedAt: 19_000 }],
  });
  assert.equal(hidden.observations[0].value.privacy, "HIDDEN");
  assert.equal(JSON.stringify(hidden).includes("Hidden Road"), false);
  assert.equal(hidden.observations[0].value.count, undefined);
});

test("readings from before monitoring began are not stored", () => {
  const result = runMonitor(liveMonitor(), 20_000, {
    env: { SPATIAL_MONITORING: "1" },
    registry,
    listing,
    readings: [{ provider: "overpass", value: 8, observedAt: 500, source: "OpenStreetMap" }],
  });
  assert.deepEqual(result.observations, []);
  assert.equal(result.ignored[0].reason, "before_monitoring_began");
});

test("the notification policy is a stub and does not send", () => {
  let sent = 0;
  const decision = decideNotification({ provider: "overpass" }, { channel: "whatsapp" });
  assert.equal(decision.notify, false);
  assert.equal(decision.reason, "notification_policy_stub");
  assert.equal(decision.channel, "whatsapp");
  const result = runMonitor(liveMonitor(), 20_000, {
    env: { SPATIAL_MONITORING: "1" },
    registry,
    listing,
    policy: { channel: "whatsapp" },
    send: () => { sent += 1; },
    readings: [{ provider: "overpass", value: 4, observedAt: 19_000, source: "OpenStreetMap" }],
  });
  assert.equal(sent, 0);
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].notify, false);
  assert.equal(result.alerts[0].channel, "whatsapp");
});
