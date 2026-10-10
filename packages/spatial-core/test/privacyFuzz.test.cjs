// Fuzz + property tests: no exact protected coordinate escapes any
// spatial-core output surface (public context, tools + logs, monitor,
// history, anomalies, share/directions URLs). Seeded, deterministic.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/index.cjs");
const { stripPrivateLocationKeys, assertNoPrivateLocationKeys, PRIVATE_LOCATION_KEYS } = require("../src/privacy.cjs");

const RUNS = 200;
const CAMPUS = core.CAMPUSES ? core.CAMPUSES[0].id : "futo";

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 7-decimal coordinates; never equal to a 3-decimal approx snap.
function coord(r) {
  const lat = Number((4 + r() * 9).toFixed(7));
  const lng = Number((3 + r() * 11).toFixed(7));
  const fix = (v) => (String(v).split(".")[1] || "").length >= 5 ? v : Number((v + 0.0000013).toFixed(7));
  return { lat: fix(lat), lng: fix(lng) };
}

function pick(r, list) {
  return list[Math.floor(r() * list.length)];
}

const PRIVATE = [...PRIVATE_LOCATION_KEYS];

function coordString(r, c) {
  return pick(r, [
    `${c.lat},${c.lng}`,
    `near ${c.lat}, ${c.lng} by the gate`,
    `geo:${c.lat};${c.lng}`,
    `https://maps.example/?q=${c.lat}%2C${c.lng}`,
    JSON.stringify({ lat: c.lat, lng: c.lng }),
  ]);
}

// Random nested object whose protected values only live under private keys.
function protectedBlob(r, c, depth = 0) {
  const out = {};
  const n = 1 + Math.floor(r() * 4);
  for (let i = 0; i < n; i += 1) {
    const roll = r();
    if (roll < 0.4) {
      const key = pick(r, PRIVATE);
      out[key] = pick(r, [c.lat, c.lng, coordString(r, c), { lat: c.lat, lng: c.lng }, [c.lat, c.lng]]);
    } else if (roll < 0.7 && depth < 4) {
      const inner = protectedBlob(r, c, depth + 1);
      out[`n${i}`] = r() < 0.5 ? inner : [inner, { count: i }];
    } else {
      out[`k${i}`] = pick(r, [i, "ok", true, null, { count: i }]);
    }
  }
  return out;
}

function leaks(value, c) {
  const text = JSON.stringify(value) || "";
  return text.includes(String(c.lat)) || text.includes(String(c.lng));
}

function protectedListing(r, id, c) {
  return {
    id,
    title: "Fuzz home",
    status: "VERIFIED",
    reviewStatus: "APPROVED",
    riskState: "VERIFIED",
    public: true,
    category: "rent",
    property: Object.assign(
      { lga: "Owerri West", city: "Owerri", state: "Imo" },
      { latitude: c.lat, longitude: c.lng, address: coordString(r, c), landmark: coordString(r, c) },
    ),
    exactLat: c.lat,
    exactLng: c.lng,
    exactLatitude: c.lat,
    exactLongitude: c.lng,
    approxLocation: { lat: Number(c.lat.toFixed(2)), lng: Number(c.lng.toFixed(2)), radius_m: 500 },
    private: protectedBlob(r, c),
  };
}

test("property: stripPrivateLocationKeys removes every protected value from random nested objects", () => {
  const r = rng(11);
  for (let i = 0; i < RUNS; i += 1) {
    const c = coord(r);
    const blob = protectedBlob(r, c);
    const safe = stripPrivateLocationKeys(blob);
    assert.equal(leaks(safe, c), false, JSON.stringify(blob));
    assert.doesNotThrow(() => assertNoPrivateLocationKeys(safe));
    if (leaks(blob, c)) assert.throws(() => assertNoPrivateLocationKeys(blob));
  }
});

test("fuzz: public context and listing adapter never carry an exact coordinate", () => {
  const r = rng(13);
  for (let i = 0; i < RUNS; i += 1) {
    const c = coord(r);
    const listing = protectedListing(r, i + 1, c);
    const ctx = core.buildPublicSpatialContext(listing);
    const adapted = core.adaptSpatialListing({ listing, purpose: "rent", authorizedLocation: { lat: c.lat, lng: c.lng } });
    assert.equal(leaks(ctx, c), false);
    assert.equal(leaks(adapted, c), false);
    assert.equal(leaks(core.focusFromPublicListing(listing), c), false);
  }
});

test("fuzz: share/directions URLs never embed a protected origin", () => {
  const r = rng(17);
  for (let i = 0; i < RUNS; i += 1) {
    const c = coord(r);
    const url = core.externalDirectionsUrl({
      destination: { lat: 5.38, lng: 6.99, name: "FUTO" },
      originExact: { lat: c.lat, lng: c.lng },
      precision: pick(r, ["exact", "approximate", "area-only", "unknown"]),
      fixturePin: false,
      allowExactOrigin: r() < 0.5,
      originLabel: "Owerri West",
    });
    assert.equal(core.urlLeaksCoordinates(url, [c]), false, url);
  }
});

test("fuzz: every tool result and tool log omits protected coordinates", async () => {
  const r = rng(19);
  const tools = core.listTools();
  const outcomes = new Set();
  for (let i = 0; i < 40; i += 1) {
    const c = coord(r);
    const a = protectedListing(r, 1, c);
    const b = protectedListing(r, 2, c);
    const logs = [];
    for (const { name, inputSchema } of tools) {
      const all = { listingId: 1, listingIds: [1, 2], campusId: CAMPUS, query: coordString(r, c).slice(0, 80), category: "all" };
      const input = {};
      Object.keys(inputSchema.properties).forEach((key) => { input[key] = all[key]; });
      if (r() < 0.2) input.note = coordString(r, c);
      const result = await core.callTool(name, input, {
        listings: [a, b],
        isPublicListing: (row) => Boolean(row && row.public === true),
        env: {},
        providers: [],
        fetchImpl: async () => { throw new Error("no network in tests"); },
        log: (event) => logs.push(event),
        now: 1_700_000_000_000,
      });
      outcomes.add(`${name}:${result.ok ? "ok" : result.code}`);
      assert.equal(leaks(result, c), false, `${name}: ${JSON.stringify(result)}`);
    }
    assert.equal(leaks(logs, c), false);
  }
  // The fuzz must reach real handlers, not just schema rejection.
  assert.ok([...outcomes].filter((o) => o.endsWith(":ok")).length >= 8, [...outcomes].join(" "));
});

const registry = [{
  id: "overpass",
  status: "cleared",
  commercialUse: "APPROVED_WITH_ATTRIBUTION",
  rateLimits: { perMinuteDefault: 30 },
  freshnessPolicy: { staleAfterMs: 1000, minIntervalMs: 5000 },
}];

function monitor() {
  return {
    id: "mon-f",
    targetType: "listing",
    target: { listingId: 1 },
    providers: ["overpass"],
    observationType: "amenityCount",
    baseline: { value: 3 },
    conditions: [{ op: "changed" }],
    schedule: { intervalMs: 5000 },
    lastObservedAt: null,
    monitoringBeganAt: 1_000,
    state: "idle",
  };
}

test("fuzz: monitor runs (approximate/hidden) never echo protected coordinates", () => {
  const r = rng(23);
  for (let i = 0; i < RUNS; i += 1) {
    const c = coord(r);
    const listing = protectedListing(r, 1, c);
    const result = core.runMonitor(monitor(), 20_000, {
      env: { SPATIAL_MONITORING: "1" },
      registry,
      listing: r() < 0.8 ? listing : Object.assign({}, listing, { public: false }),
      authorization: pick(r, ["APPROXIMATE", "HIDDEN", "AUTHORIZED_EXACT", "PUBLIC_EXACT", undefined]),
      readings: [{ provider: "overpass", value: protectedBlob(r, c), observedAt: 19_000 }],
    });
    assert.equal(leaks(result, c), false, JSON.stringify(result));
  }
});

function observation(at, value) {
  return {
    id: `obs-${at}`,
    observedAt: at,
    envelope: { value, provider: "overpass", source: "OpenStreetMap", license: "ODbL-1.0", observedAt: at, retrievedAt: at, freshness: "fresh", confidence: 0.9, classification: "OBSERVED" },
  };
}

test("fuzz: history, replay, changes, compare and anomalies never echo protected coordinates", () => {
  const r = rng(29);
  const ctx = { env: { SPATIAL_HISTORY: "1", SPATIAL_ANOMALIES: "1" } };
  for (let i = 0; i < 80; i += 1) {
    const c = coord(r);
    const observations = [2_000, 3_000, 4_000].map((at) => observation(at, protectedBlob(r, c)));
    const snapshots = [5_000, 6_000].map((at) => ({
      id: `snap-${at}`,
      capturedAt: at,
      facts: [{ key: "a", envelope: observation(at, protectedBlob(r, c)).envelope }],
      report: protectedBlob(r, c),
    }));
    const input = { monitor: monitor(), observations, snapshots, from: 0, to: 10_000, since: 0, at: 9_000 };
    const outputs = [
      core.getSpatialHistory(input, ctx),
      core.getChangesSince(input, ctx),
      core.replaySpatialContext(input, ctx),
      core.compareSpatialSnapshots(snapshots[0], snapshots[1], ctx),
      core.recordReportSnapshot(monitor(), protectedBlob(r, c), 7_000, ctx),
      core.evaluateAnomalies(Object.assign({ now: 9_000 }, input), ctx),
    ];
    outputs.forEach((out, idx) => assert.equal(leaks(out, c), false, `${idx}: ${JSON.stringify(out)}`));
  }
});

test("control: the leak detector does see coordinates when exact access is authorized", () => {
  const c = { lat: 5.4831927, lng: 7.0412345 };
  const obs = [observation(2_000, { latitude: c.lat, count: 1 })];
  const open = core.getSpatialHistory({ monitor: monitor(), observations: obs, from: 0, to: 9_000 },
    { env: { SPATIAL_HISTORY: "1" }, authorized: true, authorization: "AUTHORIZED_EXACT" });
  assert.equal(leaks(open, c), true);
  const closed = core.getSpatialHistory({ monitor: monitor(), observations: obs, from: 0, to: 9_000 },
    { env: { SPATIAL_HISTORY: "1" } });
  assert.equal(closed.events.length, 1);
  assert.equal(leaks(closed, c), false);
});
