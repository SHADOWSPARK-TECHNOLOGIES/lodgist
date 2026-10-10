const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  loadAmenities,
  loadRoute,
  campusById,
  createSafeguardState,
  cachePermitted,
  DEFAULT_DAILY_BUDGET,
  parseOverpass,
} = require("../src/index.cjs");
const { fetchAllowlisted, isPublicAddress } = require("../src/proxy.cjs");
const { buildAmenityQuery, LEGACY_AMENITY_QUERY } = require("../src/overpassQuery.cjs");

const focus = {
  precision: "approximate",
  label: "Near Nekede",
  lat: 5.4214,
  lng: 7.0419,
  radiusM: 800,
};
const cleared = [{ id: "overpass", status: "cleared", commercialUse: "APPROVED_WITH_ATTRIBUTION" }];
const publicLookup = async () => [{ address: "1.1.1.1", family: 4 }];

test("public address checks refuse loopback, private, and link-local targets", () => {
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("127.0.0.1"), false);
  assert.equal(isPublicAddress("10.1.1.1"), false);
  assert.equal(isPublicAddress("192.168.0.8"), false);
  assert.equal(isPublicAddress("169.254.169.254"), false);
  assert.equal(isPublicAddress("::1"), false);
});

test("the proxy refuses a host outside the allowlist and an off-origin redirect", async () => {
  let calls = 0;
  const blocked = await fetchAllowlisted({
    url: "https://evil.example/interpreter",
    allowedHosts: ["overpass.example"],
    lookup: publicLookup,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    },
  });
  assert.equal(blocked.code, "forbidden");
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(blocked).includes("evil.example"), false);

  const redirected = await fetchAllowlisted({
    url: "https://overpass.example/interpreter",
    allowedHosts: ["overpass.example"],
    lookup: publicLookup,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 302, headers: { location: "https://evil.example/steal" }, json: async () => ({}) };
    },
  });
  assert.equal(redirected.code, "forbidden");
  assert.equal(calls, 1);
});

test("a private DNS answer is not fetched", async () => {
  let calls = 0;
  const result = await fetchAllowlisted({
    url: "https://overpass.example/interpreter",
    allowedHosts: ["overpass.example"],
    lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    },
  });
  assert.equal(result.code, "forbidden");
  assert.equal(calls, 0);
});

test("upstream failure serves the stale cached amenity", async () => {
  let calls = 0;
  let now = 0;
  const state = createSafeguardState();
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return { ok: true, status: 200, json: async () => ({ elements: [{ type: "node", id: 1, lat: 5.422, lon: 7.042, tags: { amenity: "pharmacy", name: "Fixture Chemist" } }] }) };
    }
    return { ok: false, status: 503, json: async () => ({ error: "upstream detail" }) };
  };
  const first = await loadAmenities({
    focus,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter", SPATIAL_CACHE_TTL_MS: "1000" },
    registry: cleared,
    safeguardState: state,
    lookup: publicLookup,
    fetchImpl,
    now: () => now,
  });
  now = 1000;
  const second = await loadAmenities({
    focus,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter", SPATIAL_CACHE_TTL_MS: "1000" },
    registry: cleared,
    safeguardState: state,
    lookup: publicLookup,
    fetchImpl,
    now: () => now,
  });
  assert.equal(first.items[0].name, "Fixture Chemist");
  assert.equal(second.items[0].name, "Fixture Chemist");
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(second).includes("upstream detail"), false);
});

test("an unreadable daily budget falls back to the finite default", async () => {
  let calls = 0;
  const state = createSafeguardState();
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => ({ elements: [] }) };
  };
  for (let i = 0; i < DEFAULT_DAILY_BUDGET + 1; i += 1) {
    await loadAmenities({
      focus: { ...focus, lat: 5 + (i / 10000) },
      env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter", SPATIAL_DAILY_BUDGET_OVERPASS: "3O" },
      registry: cleared,
      safeguardState: state,
      lookup: publicLookup,
      fetchImpl,
      now: () => Date.UTC(2026, 9, 10, 12),
    });
  }
  assert.equal(calls, DEFAULT_DAILY_BUDGET);
});

test("Google content is not cached", async () => {
  assert.equal(cachePermitted("google-places", "ttl"), false);
  assert.equal(cachePermitted("overpass", "never"), false);
  assert.equal(cachePermitted("overpass", "ttl"), true);
  let calls = 0;
  const state = createSafeguardState();
  const run = () => loadAmenities({
    focus,
    cachePolicy: "never",
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: cleared,
    safeguardState: state,
    lookup: publicLookup,
    now: () => 5,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  });
  await run();
  await run();
  assert.equal(calls, 2);
});

test("way and area queries stay behind the guarded builder and the legacy query is node-only", () => {
  const legacy = LEGACY_AMENITY_QUERY(800, 5.4214, 7.0419);
  assert.equal(legacy.includes("way["), false);
  assert.equal(legacy.includes("relation["), false);
  assert.equal(buildAmenityQuery({ radius: 800, lat: 5.4214, lng: 7.0419, elements: ["node"] }), legacy);
  const upgraded = buildAmenityQuery({ radius: 800, lat: 5.4214, lng: 7.0419, elements: ["node", "way", "area"] });
  assert.equal(upgraded.includes("way["), true);
  assert.equal(upgraded.includes('relation["amenity"="pharmacy"]'), true);
  assert.equal(upgraded.includes("out center"), true);
  const parsed = parseOverpass({
    elements: [{ type: "way", id: 4, center: { lat: 5.422, lon: 7.042 }, tags: { shop: "convenience", name: "Way Shop" } }],
  });
  assert.equal(parsed[0].id, "osm-way-4");
  assert.equal(parsed[0].category, "shop");
});

test("a guarded route still refuses a private lookup", async () => {
  let calls = 0;
  const result = await loadRoute({
    focus,
    campus: campusById("fpno"),
    env: { OSRM_BASE_URL: "https://routing.example" },
    registry: [{ id: "osrm", status: "cleared" }],
    safeguardState: createSafeguardState(),
    lookup: async () => [{ address: "10.0.0.4", family: 4 }],
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ code: "Ok", routes: [{ distance: 1, duration: 1 }] }) };
    },
    now: () => 1,
  });
  assert.equal(calls, 0);
  assert.equal(result.status, "failed");
});

test("proxy timeout does not echo the upstream url", async () => {
  const result = await fetchAllowlisted({
    url: "https://overpass.example/interpreter",
    allowedHosts: ["overpass.example"],
    lookup: publicLookup,
    timeoutMs: 30,
    fetchImpl: () => new Promise(() => {}),
  });
  assert.equal(result.code, "timeout");
  assert.equal(JSON.stringify(result).includes("overpass.example"), false);
});
