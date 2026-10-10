const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  compareSpatialSnapshots,
  getChangesSince,
  getSpatialHistory,
  historyEnabled,
  recordReportSnapshot,
  replaySpatialContext,
} = require("../src/index.cjs");

const monitor = { id: "mon-1", monitoringBeganAt: 1_000, targetType: "listing", target: { listingId: 42 } };
const on = { env: { SPATIAL_HISTORY: "1" } };

function observation(observedAt, value, extra = {}) {
  return {
    id: `obs-${observedAt}`,
    observedAt,
    envelope: Object.assign({
      value,
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

test("history is off unless SPATIAL_HISTORY is set", () => {
  assert.equal(historyEnabled({}), false);
  assert.equal(historyEnabled({ SPATIAL_MONITORING: "1" }), false);
  const result = getSpatialHistory({
    monitor,
    observations: [observation(2_000, { address: "12 Hidden Road" })],
  }, { env: {} });
  assert.equal(result.code, "flag_off");
  assert.deepEqual(result.events, []);
  assert.equal(JSON.stringify(result).includes("Hidden Road"), false);
});

test("empty history states when monitoring began", () => {
  const result = getSpatialHistory({ monitor, observations: [], snapshots: [] }, on);
  assert.equal(result.code, "empty_history");
  assert.equal(result.historyBeganAt, 1_000);
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.snapshots, []);
  assert.equal(result.provenance.observedAt, null);
});

test("a range before monitoring began is history_unavailable_before", () => {
  const result = getSpatialHistory({
    monitor,
    from: 1,
    to: 500,
    observations: [observation(200, 9), observation(2_000, 4)],
  }, on);
  assert.equal(result.code, "history_unavailable_before");
  assert.equal(result.historyBeganAt, 1_000);
  assert.deepEqual(result.events, []);
  assert.equal(JSON.stringify(result).includes("9"), false);
});

test("stored rows from before monitoring began are not replayed as history", () => {
  const result = getSpatialHistory({
    monitor,
    from: 0,
    to: 5_000,
    observations: [observation(500, { count: 1, address: "12 Hidden Road" }), observation(2_000, { count: 4, area: { lat: 5.495, lng: 7.035, radius_m: 500 } })],
  }, on);
  assert.equal(result.code, "ok");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].observedAt, 2_000);
  assert.equal(result.events[0].value.count, 4);
  assert.equal(result.unavailableBefore, 1_000);
  assert.equal(result.events[0].provenance.source, "OpenStreetMap");
  assert.equal(result.events[0].provenance.license, "ODbL-1.0");
});

test("listing history drops exact location fields", () => {
  const result = getSpatialHistory({
    monitor,
    observations: [observation(2_000, {
      count: 4,
      latitude: 5.497123,
      longitude: 7.033812,
      address: "12 Hidden Road",
      landmark: "Secret junction",
      area: { lat: 5.495, lng: 7.035, radius_m: 500 },
    })],
  }, on);
  const encoded = JSON.stringify(result);
  assert.equal(encoded.includes("12 Hidden Road"), false);
  assert.equal(encoded.includes("Secret junction"), false);
  assert.equal(encoded.includes("latitude"), false);
  assert.equal(encoded.includes("5.497123"), false);
  assert.equal(result.events[0].value.count, 4);
  assert.equal(result.events[0].value.area.lat, 5.495);
});

test("snapshot comparison is deterministic", () => {
  const before = { report: { observations: [
    { provider: "overpass", subjectId: "listing:42", fact: "amenityCount", value: 3, observedAt: 2_000, freshness: "fresh", classification: "OBSERVED" },
  ] } };
  const after = { report: { observations: [
    { provider: "overpass", subjectId: "listing:42", fact: "amenityCount", value: 5, observedAt: 4_000, freshness: "fresh", classification: "OBSERVED" },
    { provider: "places", subjectId: "listing:42", fact: "amenityCount", value: 5, observedAt: 4_000, freshness: "stale", classification: "ESTIMATED" },
  ] } };
  const first = compareSpatialSnapshots(before, after, on);
  const second = compareSpatialSnapshots(before, after, on);
  assert.deepEqual(first, second);
  assert.equal(first.changed.length, 1);
  assert.equal(first.added.length, 1);
  assert.equal(first.removed.length, 0);
  assert.equal(first.changed[0].before.value, 3);
  assert.equal(first.changed[0].after.value, 5);
  assert.equal(first.added[0].key.startsWith("places"), true);
});

test("changes since a pre-monitoring instant do not invent earlier rows", () => {
  const result = getChangesSince({
    monitor,
    since: 100,
    observations: [observation(500, 1), observation(2_000, 3), observation(4_000, 5)],
  }, on);
  assert.equal(result.historyBeganAt, 1_000);
  assert.equal(result.unavailableBefore, 1_000);
  assert.deepEqual(result.events.map((event) => event.observedAt), [2_000, 4_000]);
  assert.equal(result.changes.length, 1);
  assert.equal(JSON.stringify(result).includes('"value":1'), false);
});

test("replay before monitoring began is unavailable and does not fill a context", () => {
  const missing = replaySpatialContext({
    monitor,
    at: 500,
    observations: [observation(2_000, 4)],
    snapshots: [{ id: "snap-1", capturedAt: 2_000, report: { observations: [] } }],
  }, on);
  assert.equal(missing.code, "history_unavailable_before");
  assert.equal(missing.context, null);
  const empty = replaySpatialContext({ monitor, at: 1_500, observations: [], snapshots: [] }, on);
  assert.equal(empty.code, "empty_history");
  assert.equal(empty.context, null);
  assert.equal(empty.historyBeganAt, 1_000);
  const replay = replaySpatialContext({
    monitor,
    at: 3_000,
    observations: [observation(500, { address: "12 Hidden Road" }), observation(2_000, { count: 4, area: { lat: 5.495, lng: 7.035, radius_m: 500 } }), observation(4_000, { count: 9 })],
    snapshots: [
      { id: "early", capturedAt: 200, report: { summary: "fabricated" } },
      { id: "snap-2", capturedAt: 2_500, report: { observations: [{ provider: "overpass", fact: "amenityCount", value: 4 }] } },
    ],
  }, on);
  assert.equal(replay.code, "ok");
  assert.equal(replay.context.observation.observedAt, 2_000);
  assert.equal(replay.context.observation.value.count, 4);
  assert.equal(replay.context.report.observations[0].value, 4);
  assert.equal(replay.context.provenance.historyBeganAt, 1_000);
  assert.equal(JSON.stringify(replay).includes("fabricated"), false);
  assert.equal(JSON.stringify(replay).includes("Hidden Road"), false);
});

test("a report captured before monitoring began is not stored as history", () => {
  const early = recordReportSnapshot(monitor, { summary: "fabricated" }, 200, on);
  assert.equal(early.code, "history_unavailable_before");
  assert.equal(early.snapshot, undefined);
  const recorded = recordReportSnapshot(monitor, {
    observations: [{ provider: "overpass", fact: "amenityCount", value: 4, address: "12 Hidden Road" }],
  }, 2_500, on);
  assert.equal(recorded.code, "ok");
  assert.equal(recorded.snapshot.capturedAt, 2_500);
  assert.equal(recorded.snapshot.provenance.historyBeganAt, 1_000);
  assert.equal(JSON.stringify(recorded).includes("Hidden Road"), false);
});

test("snapshot diff strips exact location fields", () => {
  const before = { report: { observations: [{
    provider: "overpass",
    fact: "pin",
    value: { latitude: 5.497123, address: "12 Hidden Road", area: { lat: 5.495 } },
    observedAt: 2_000,
  }] } };
  const after = { report: { observations: [{
    provider: "overpass",
    fact: "pin",
    value: { count: 2, area: { lat: 5.495 } },
    observedAt: 4_000,
  }] } };
  const diff = compareSpatialSnapshots(before, after, on);
  const encoded = JSON.stringify(diff);
  assert.equal(encoded.includes("Hidden Road"), false);
  assert.equal(encoded.includes("latitude"), false);
  assert.equal(encoded.includes("5.497123"), false);
  assert.equal(diff.changed[0].before.value.area.lat, 5.495);
});
