const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/index.cjs");

const NOW = Date.parse("2026-10-10T12:00:00Z");
const H = 3600 * 1000;

test("12D: ingest/update/expire/inspect/history lifecycle", () => {
  let t = NOW;
  const store = core.createEntityStore({ now: () => t });
  const e = { id: "rd-1", type: "ROAD_INCIDENT", source: "fmw-bulletin", observedAt: NOW - H, expiresAt: NOW + 2 * H,
    position: { precision: "APPROXIMATE", lat: 6.51234, lng: 3.38999, areaLabel: "Yaba" }, metadata: { note: "lane closed", latitude: 6.5 } };
  const ing = store.ingest(e);
  assert.equal(ing.ok, true);
  assert.equal(ing.entity.position.lat, 6.51);
  assert.equal(ing.entity.metadata.latitude, undefined);
  assert.equal(ing.entity.freshness, "FRESH");
  assert.equal(store.ingest(e).code, "duplicate");
  assert.equal(store.update("rd-1", { observedAt: NOW - 2 * H }).code, "out_of_order");
  assert.equal(store.update("rd-1", { observedAt: NOW, state: "RESOLVED" }).entity.state, "RESOLVED");
  t = NOW + 3 * H;
  assert.equal(store.inspect("rd-1").entity.state, "EXPIRED");
  assert.equal(store.update("rd-1", {}).code, "expired");
  assert.deepEqual(store.history("rd-1").entries.map((x) => x.action), ["ingest", "update", "expire"]);
  ["id", "type", "position", "source", "observedAt", "expiresAt", "freshness", "state", "metadata"].forEach((k) => assert.ok(k in store.inspect("rd-1").entity, k));
});

test("12D: aircraft, vessel, military and person types are refused", () => {
  const store = core.createEntityStore();
  for (const type of ["AIRCRAFT", "VESSEL", "MILITARY_ASSET", "PERSON", "VEHICLE_TRACK", "FLIGHT"]) {
    assert.equal(store.ingest({ id: type, type, source: "x", observedAt: NOW, position: { precision: "APPROXIMATE", areaLabel: "x" } }).code, "refused_type", type);
  }
});

test("12D: protected positions and missing evidence are refused; empty authoritative coverage is valid", () => {
  const store = core.createEntityStore({ authoritative: true });
  const base = { id: "i", type: "INSPECTION", source: "lodgist", observedAt: NOW };
  assert.equal(store.ingest(Object.assign({}, base, { position: { precision: "AUTHORIZED_EXACT", lat: 1, lng: 1 } })).code, "protected_position");
  assert.equal(store.ingest(Object.assign({}, base, { source: "", position: { precision: "APPROXIMATE", areaLabel: "a" } })).code, "missing_source");
  assert.equal(store.ingest(Object.assign({}, base, { observedAt: null, position: { precision: "APPROXIMATE", areaLabel: "a" } })).code, "missing_observed_at");
  const listed = store.list();
  assert.deepEqual(listed.entities, []);
  assert.equal(listed.coverage, "authoritative_empty");
  assert.equal(core.createEntityStore().list().coverage, "unknown");
});

const obs = (h, cls, extra) => Object.assign({ id: `o${h}`, provider: "nimet", source: "bulletin", observedAt: NOW - h * H, classification: cls, confidence: 0.8, fact: "rainfallMm", value: { mm: 40, lat: 6.5, latitude: 6.5 }, license: "CC-BY-4.0" }, extra);

test("12C: no evidence -> no event", () => {
  const r = core.reconstructEvent({ type: "FLOOD", area: { areaLabel: "Yaba" }, observations: [] }, { now: NOW });
  assert.equal(r.code, "no_evidence");
  assert.equal(r.event, null);
});

test("12C: ordered timeline, gaps UNKNOWN, label RECONSTRUCTED, never live", () => {
  const r = core.reconstructEvent({
    type: "FLOOD",
    area: { areaLabel: "Yaba", latitude: 6.5, lat: 6.5 },
    observations: [obs(1, "OBSERVED"), obs(20, "ESTIMATED"), obs(2, "DERIVED")],
    anomalies: [{ family: "FLOOD_RISK_CHANGE", severity: "high", confidence: 0.6, reason: "risk up", triggeredAt: NOW - 1.5 * H }],
  }, { now: NOW });
  assert.equal(r.ok, true);
  const ev = r.event;
  assert.equal(ev.label, "RECONSTRUCTED");
  const times = ev.timeline.map((e) => Date.parse(e.at));
  assert.deepEqual(times, times.slice().sort((a, b) => a - b));
  assert.deepEqual(ev.timeline.map((e) => e.kind), ["ESTIMATED", "UNKNOWN", "DERIVED", "DERIVED", "OBSERVED"]);
  ev.timeline.forEach((e) => assert.ok(core.TIMELINE_KINDS.includes(e.kind)));
  assert.ok(ev.warnings.includes(core.LIVE_WARNING));
  assert.equal(ev.confidence, 0.6);
  assert.equal(ev.impact.severity, "high");
  assert.ok(ev.sources.some((s) => s.provider === "nimet" && s.license === "CC-BY-4.0"));
  const text = JSON.stringify(ev);
  assert.ok(!/"lat"|"latitude"/.test(text));
  assert.ok(!/live|real-time|happening now/i.test(text.replace(core.LIVE_WARNING, "")));
  ["id", "type", "area", "timeRange", "timeline", "observations", "anomalies", "sources", "confidence", "impact", "warnings", "label"].forEach((k) => assert.ok(k in ev, k));
});

test("12C: unsupported types and private-only areas are refused", () => {
  assert.equal(core.reconstructEvent({ type: "AIRCRAFT_TRACK", area: { areaLabel: "x" }, observations: [obs(1, "OBSERVED")] }).code, "unsupported_type");
  assert.equal(core.reconstructEvent({ type: "FLOOD", area: { latitude: 1, longitude: 2 }, observations: [obs(1, "OBSERVED")] }).code, "missing_public_area");
  core.EVENT_TYPES.forEach((type) => {
    assert.equal(core.reconstructEvent({ type, area: { areaLabel: "x" }, observations: [obs(1, "OBSERVED")] }, { now: NOW }).ok, true, type);
  });
});
