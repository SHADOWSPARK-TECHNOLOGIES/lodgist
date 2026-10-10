const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/index.cjs");

const NOW = Date.parse("2026-10-10T12:00:00Z");
const PUBLIC = { id: 1, title: "Room near IMSU", public: true, approxLocation: { lat: 5.505, lng: 7.045, radius_m: 500 }, property: { city: "Owerri", state: "Imo" } };
const PRIVATE = { id: 2, title: "Hidden flat", public: false, latitude: 5.5123456, longitude: 7.0412345, approxLocation: { lat: 5.51, lng: 7.04, radius_m: 500 } };
const ctx = () => ({ listings: [PUBLIC, PRIVATE], isPublicListing: (l) => l.public === true, now: NOW });

test("12E: share state keeps only public state; URL carries no coordinates", () => {
  const store = core.createShareStore({ now: () => NOW });
  const made = store.create({
    center: { lat: 5.5123456, lng: 7.0412345 }, zoom: 18, pitch: 45, bearing: 10,
    entity: { type: "listing", id: 1 }, layers: ["schools", "flights", "cctv"],
    route: { listingId: 1, campusId: "imsu", destination: { lat: 5.6, lng: 7.1 } },
    annotations: [{ text: "Near the market" }, { text: "Exact gate at 5.5123456,7.0412345" }, { text: "token=abc" }],
    token: "sekret", session: "s", privacy: "AUTHORIZED_EXACT", precision: "exact",
  }, ctx());
  assert.equal(made.path.includes("5.5"), false);
  assert.ok(!core.urlLeaksCoordinates(made.path, [{ lat: 5.5123456, lng: 7.0412345 }]));
  const opened = store.open(made.token, ctx());
  assert.equal(opened.ok, true);
  const text = JSON.stringify(opened.state);
  assert.ok(!text.includes("5.5123456") && !text.includes("sekret") && !text.includes("AUTHORIZED_EXACT"));
  assert.deepEqual(opened.state.center, { lat: 5.505, lng: 7.045 });
  assert.deepEqual(opened.state.layers, ["schools"]);
  assert.equal(opened.state.route, null); // route carried a private destination -> dropped
  assert.deepEqual(opened.state.annotations, [{ text: "Near the market" }]);
  assert.ok(opened.state.zoom <= 15);
});

test("12E: protected listing entity never shared; unanchored center is coarsened", () => {
  const gated = core.gateShareState({ entity: { type: "listing", id: 2 }, center: { lat: 5.5123456, lng: 7.0412345 }, zoom: 18 }, ctx());
  assert.equal(gated.state.entity, null);
  assert.deepEqual(gated.state.center, { lat: 5.51, lng: 7.04 });
  assert.ok(gated.state.zoom <= 14);
});

test("12E: open re-runs the privacy gate against current state; expiry enforced", () => {
  let t = NOW;
  const store = core.createShareStore({ now: () => t });
  const made = store.create({ entity: { type: "listing", id: 1 } }, ctx(), 1000);
  const unpublished = { listings: [Object.assign({}, PUBLIC, { public: false })], isPublicListing: (l) => l.public === true };
  const reopened = store.open(made.token, unpublished);
  assert.equal(reopened.state.entity, null);
  assert.ok(reopened.dropped.includes("entity"));
  // tampered payload claiming exact precision is ignored
  const forged = core.serializeShareState({ v: 1, entity: { type: "listing", id: 2 }, center: { lat: 5.5123456, lng: 7.0412345 }, precision: "AUTHORIZED_EXACT" });
  const o = core.openShareState(forged, ctx());
  assert.equal(o.state.entity, null);
  assert.ok(!JSON.stringify(o.state).includes("5.5123456"));
  assert.equal(core.openShareState("!!!", ctx()).code, "malformed");
  t = NOW + 2000;
  assert.equal(store.open(made.token, ctx()).code, "expired");
});

test("12F: invalid scenes rejected (executable, URL, coords, protected focus, bad layer, unsupported claim)", () => {
  const base = { version: 1, type: "PROPERTY_OVERVIEW", title: "T", steps: [{ kind: "focus", target: { type: "listing", id: 1 } }] };
  assert.equal(core.validateScene(base, ctx()).ok, true);
  const bad = [
    { steps: [{ kind: "caption", text: "javascript:alert(1)", factual: false }] },
    { steps: [{ kind: "caption", text: "see https://evil", factual: false }] },
    { steps: [{ kind: "caption", text: "Gate at 5.5123456", factual: false }] },
    { steps: [{ kind: "focus", target: { type: "listing", id: 2 } }] },
    { steps: [{ kind: "layer", layerId: "flights" }] },
    { steps: [{ kind: "caption", text: "Very safe area with great schools" }] },
    { steps: [{ kind: "caption", text: "x", factual: true, evidence: { kind: "VIBES" } }] },
    { steps: [{ kind: "camera", zoom: 20 }] },
    { steps: [{ kind: "script", code: "x" }] },
    { type: "AIRCRAFT_TRACK" },
  ];
  bad.forEach((patch, i) => assert.equal(core.validateScene(Object.assign({}, base, patch), ctx()).ok, false, String(i)));
});

test("12G: property tour runs tools in order, passes the privacy gate and validates", async () => {
  const calls = [];
  const c = Object.assign(ctx(), { log: (e) => calls.push(e.tool) });
  const r = await core.callTool("lodgist.create_property_tour", { listingId: 1, destination: "imsu" }, c);
  assert.equal(r.ok, true);
  assert.equal(r.data.ok, true);
  assert.deepEqual(calls.slice(0, 4), ["lodgist.inspect_property", "lodgist.property_context", "lodgist.nearby_amenities", "lodgist.calculate_commute"]);
  const scene = r.data.scene;
  assert.equal(core.validateScene(scene, c).ok, true);
  assert.equal(scene.fallback2d, true);
  scene.steps.filter((s) => s.kind === "caption" && s.factual !== false).forEach((s) => assert.ok(s.evidence && s.evidence.kind, s.text));
  assert.ok(scene.steps.some((s) => s.evidence && s.evidence.kind === "DATA_UNAVAILABLE"));
  assert.ok(!JSON.stringify(r).match(/latitude|5\.5123456/));
  const denied = await core.callTool("lodgist.create_property_tour", { listingId: 2 }, ctx());
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "forbidden");
});

test("12H: neighbourhood tour covers every section and flags insufficient layers", async () => {
  const r = await core.callTool("lodgist.create_neighborhood_tour", { listingId: 1 }, ctx());
  assert.equal(r.ok, true);
  const text = r.data.scene.steps.filter((s) => s.text).map((s) => s.text).join(" | ");
  ["Overview", "Roads", "Schools", "clinics", "shops", "transport", "Environment", "verified public listing", "End of neighbourhood tour"].forEach((w) => assert.ok(text.includes(w), w));
  assert.ok(r.data.scene.steps.filter((s) => s.evidence && s.evidence.kind === "DATA_UNAVAILABLE").length >= 4);
  assert.ok(!/poor (healthcare|schools)|unsafe|dangerous/i.test(text));
});

test("12O core tools exist with strict schemas and work without hosts' stores", async () => {
  const names = core.listTools().map((t) => t.name);
  ["spatial.history", "spatial.changes", "spatial.anomalies", "spatial.reconstruct_event", "spatial.provider_health", "spatial.data_quality", "spatial.create_scene",
    "lodgist.property_history", "lodgist.area_changes", "lodgist.property_intelligence", "lodgist.create_property_tour", "lodgist.create_neighborhood_tour"].forEach((n) => assert.ok(names.includes(n), n));
  const ev = await core.callTool("spatial.reconstruct_event", { listingId: 1, type: "FLOOD" }, ctx());
  assert.equal(ev.data.code, "no_evidence");
  const h = await core.callTool("spatial.history", { listingId: 1 }, ctx());
  assert.equal(h.data.code, "history_unavailable");
  const ph = await core.callTool("spatial.provider_health", {}, Object.assign(ctx(), { production: true }));
  assert.ok(ph.data.providers.every((p) => p.status !== "UP"));
  assert.equal((await core.callTool("spatial.reconstruct_event", { listingId: 1, type: "FLOOD", extra: 1 }, ctx())).code, "malformed");
  assert.equal((await core.callTool("spatial.history", { listingId: 2 }, ctx())).code, "forbidden");
  const dq = await core.callTool("spatial.data_quality", { listingId: 1 }, ctx());
  assert.ok(dq.data.combined.ruleIds.length > 0);
});
