const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  assertSchedule,
  beginMonitor,
  evaluateConditions,
  monitoringEnabled,
  providerRegistry,
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
