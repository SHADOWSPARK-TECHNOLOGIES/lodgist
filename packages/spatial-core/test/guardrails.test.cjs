const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ALLOWED_LAYERS,
  BANNED_LAYERS,
  assertLayerId,
  dataSources,
  providerGate,
  DATA_SOURCE_REVISION,
  loadAmenities,
  loadRoute,
  campusById,
  createSafeguardState,
} = require("../src/index.cjs");

const focus = {
  precision: "approximate",
  label: "Near Nekede",
  lat: 5.4214,
  lng: 7.0419,
  radiusM: 800,
};

test("layer catalog allows the lab list and refuses banned and unknown layers", () => {
  ALLOWED_LAYERS.forEach((layer) => {
    assert.equal(assertLayerId(layer), layer);
  });
  BANNED_LAYERS.forEach((layer) => {
    assert.throws(() => assertLayerId(layer), /refusing banned layer/);
  });
  assert.throws(() => assertLayerId("transit"), /layer not allowed/);
  assert.throws(() => assertLayerId("pharmacy"), /layer not allowed/);
  assert.throws(() => assertLayerId(""), /layer not allowed/);
});

test("DATA_SOURCES gate has no cleared provider and no OSRM row", () => {
  assert.equal(DATA_SOURCE_REVISION, "a922a3bfa86683ab008dbada0a37a3c956760eb7");
  const rows = dataSources();
  assert.equal(rows.some((row) => row.status === "cleared"), false);
  assert.equal(providerGate("overpass").status, "under review");
  assert.equal(providerGate("overpass").cleared, false);
  assert.equal(providerGate("tiles").status, "not connected");
  assert.equal(providerGate("geocoder").status, "not connected");
  assert.equal(providerGate("imagery").status, "rejected");
  assert.equal(providerGate("weather").status, "not connected");
  assert.equal(providerGate("traffic").status, "not connected");
  assert.equal(providerGate("osrm").status, "absent");
  assert.equal(providerGate("osrm").cleared, false);
});

test("a set provider env still does not call the network while the row is uncleared", async () => {
  let calls = 0;
  const amenities = await loadAmenities({
    focus,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    safeguardState: createSafeguardState(),
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  });
  assert.equal(amenities.status, "unconfigured");
  assert.equal(calls, 0);

  const route = await loadRoute({
    focus,
    campus: campusById("fpno"),
    env: { OSRM_BASE_URL: "https://routing.example" },
    safeguardState: createSafeguardState(),
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ code: "Ok", routes: [{ distance: 1, duration: 1 }] }) };
    },
  });
  assert.equal(route.status, "unconfigured");
  assert.equal(calls, 0);
});

test("user-supplied provider URLs are refused", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error("should not be called");
  };
  await assert.rejects(
    () => loadAmenities({
      focus,
      url: "https://evil.example/interpreter",
      config: { osrmBaseUrl: null, overpassUrl: null, tileUrl: null, attribution: null },
      fetchImpl,
    }),
    /refusing user-supplied provider URL/,
  );
  await assert.rejects(
    () => loadRoute({
      focus,
      campus: campusById("fpno"),
      env: { OSRM_BASE_URL: "https://routing.example" },
      config: { osrmBaseUrl: "https://evil.example", overpassUrl: null, tileUrl: null, attribution: null },
      registry: [{ id: "osrm", status: "cleared" }],
      safeguardState: createSafeguardState(),
      fetchImpl,
    }),
    /refusing user-supplied provider URL/,
  );
  assert.equal(calls, 0);
});
