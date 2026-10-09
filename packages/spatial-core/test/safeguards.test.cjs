const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  loadAmenities,
  loadRoute,
  campusById,
  createSafeguardState,
  DEFAULT_CACHE_TTL_MS,
  PROVIDER_BACKOFF_MS,
  DEFAULT_USER_AGENT,
} = require("../src/index.cjs");

const focus = {
  precision: "approximate",
  label: "Near Nekede",
  lat: 5.4214,
  lng: 7.0419,
  radiusM: 800,
};

const cleared = [
  { id: "overpass", status: "cleared", env: "OVERPASS_INTERPRETER_URL" },
  { id: "osrm", status: "cleared", env: "OSRM_BASE_URL" },
];

function overpassElements() {
  return {
    elements: [
      { type: "node", id: 1, lat: 5.422, lon: 7.042, tags: { amenity: "pharmacy", name: "Fixture Chemist" } },
    ],
  };
}

test("default cache ttl is 7 days and backoff is 30 seconds", () => {
  assert.equal(DEFAULT_CACHE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(PROVIDER_BACKOFF_MS, 30 * 1000);
});

test("a cache hit skips the network", async () => {
  let calls = 0;
  const state = createSafeguardState();
  const env = { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" };
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => overpassElements() };
  };
  const first = await loadAmenities({ focus, env, registry: cleared, safeguardState: state, fetchImpl, now: () => 0 });
  const second = await loadAmenities({ focus, env, registry: cleared, safeguardState: state, fetchImpl, now: () => 1000 });
  assert.equal(first.status, "ok");
  assert.equal(first.items.length, 1);
  assert.equal(second.status, "ok");
  assert.equal(second.items[0].name, "Fixture Chemist");
  assert.equal(calls, 1);
});

test("cache expires when the configured ttl has passed", async () => {
  let calls = 0;
  let now = 0;
  const state = createSafeguardState();
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => ({ elements: [] }) };
  };
  await loadAmenities({
    focus,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter", SPATIAL_CACHE_TTL_MS: "1000" },
    registry: cleared,
    safeguardState: state,
    fetchImpl,
    now: () => now,
  });
  now = 1000;
  await loadAmenities({
    focus,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter", SPATIAL_CACHE_TTL_MS: "1000" },
    registry: cleared,
    safeguardState: state,
    fetchImpl,
    now: () => now,
  });
  assert.equal(calls, 2);
});

test("429 backs off for 30 seconds and does not retry inside the window", async () => {
  let calls = 0;
  let now = 1_000_000;
  const state = createSafeguardState();
  const campus = campusById("fpno");
  const env = { OSRM_BASE_URL: "https://routing.example" };
  const fetchImpl = async () => {
    calls += 1;
    return { ok: false, status: 429, json: async () => ({}) };
  };
  const first = await loadRoute({ focus, campus, env, registry: cleared, safeguardState: state, fetchImpl, now: () => now });
  const second = await loadRoute({
    focus: { ...focus, lat: 5.43 },
    campus,
    env,
    registry: cleared,
    safeguardState: state,
    fetchImpl,
    now: () => now + 1000,
  });
  assert.equal(first.status, "failed");
  assert.equal(second.status, "failed");
  assert.equal(calls, 1);
  await loadRoute({
    focus: { ...focus, lat: 5.44 },
    campus,
    env,
    registry: cleared,
    safeguardState: state,
    fetchImpl,
    now: () => now + PROVIDER_BACKOFF_MS,
  });
  assert.equal(calls, 2);
});

test("an exhausted daily budget returns unconfigured without another request", async () => {
  let calls = 0;
  const state = createSafeguardState();
  const env = {
    OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter",
    SPATIAL_DAILY_BUDGET_OVERPASS: "1",
  };
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => ({ elements: [] }) };
  };
  const now = () => Date.UTC(2026, 9, 9, 12);
  const first = await loadAmenities({ focus, env, registry: cleared, safeguardState: state, fetchImpl, now });
  const second = await loadAmenities({
    focus: { ...focus, lat: 5.5 },
    env,
    registry: cleared,
    safeguardState: state,
    fetchImpl,
    now,
  });
  assert.equal(first.status, "empty");
  assert.equal(second.status, "unconfigured");
  assert.deepEqual(second.items, []);
  assert.equal(calls, 1);
});

test("only one request is in flight per provider", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const state = createSafeguardState();
  const campus = campusById("fpno");
  const env = { OSRM_BASE_URL: "https://routing.example" };
  const fetchImpl = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await gate;
    inFlight -= 1;
    return { ok: true, status: 200, json: async () => ({ code: "Ok", routes: [{ distance: 1000, duration: 60 }] }) };
  };
  const first = loadRoute({ focus, campus, env, registry: cleared, safeguardState: state, fetchImpl, now: () => 10 });
  const second = loadRoute({
    focus: { ...focus, lat: 5.5 },
    campus,
    env,
    registry: cleared,
    safeguardState: state,
    fetchImpl,
    now: () => 10,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(maxInFlight, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.status, "ok");
  assert.equal(b.status, "ok");
  assert.equal(maxInFlight, 1);
});

test("safeguarded requests send an identifying User-Agent", async () => {
  let seen = "";
  const state = createSafeguardState();
  await loadAmenities({
    focus,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter", SPATIAL_USER_AGENT: "Lodgist/test (ops@example.com)" },
    registry: cleared,
    safeguardState: state,
    now: () => 5,
    fetchImpl: async (_url, init) => {
      seen = init.headers["User-Agent"];
      assert.equal(init.headers["Content-Type"], "application/x-www-form-urlencoded");
      return { ok: false, status: 500, json: async () => ({}) };
    },
  });
  assert.equal(seen, "Lodgist/test (ops@example.com)");

  let fallback = "";
  await loadRoute({
    focus,
    campus: campusById("fpno"),
    env: { OSRM_BASE_URL: "https://routing.example" },
    registry: cleared,
    safeguardState: createSafeguardState(),
    now: () => 5,
    fetchImpl: async (_url, init) => {
      fallback = init.headers["User-Agent"];
      return { ok: false, status: 500, json: async () => ({}) };
    },
  });
  assert.equal(fallback, DEFAULT_USER_AGENT);
});

test("safeguards stay inactive while the provider env vars are unset", async () => {
  let calls = 0;
  let headers;
  const fetchImpl = async (_url, init) => {
    calls += 1;
    headers = init.headers;
    return { ok: false, status: 429, json: async () => ({}) };
  };
  const config = { osrmBaseUrl: null, overpassUrl: "https://overpass.example/interpreter", tileUrl: null, attribution: null };
  const first = await loadAmenities({ focus, config, fetchImpl });
  const second = await loadAmenities({ focus, config, fetchImpl });
  assert.equal(first.status, "failed");
  assert.equal(second.status, "failed");
  assert.equal(calls, 2);
  assert.equal(headers["User-Agent"], undefined);
  assert.equal(headers["Content-Type"], "application/x-www-form-urlencoded");
});
