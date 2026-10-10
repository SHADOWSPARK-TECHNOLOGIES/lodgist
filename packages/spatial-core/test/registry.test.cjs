const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  providerRegistry,
  providerCanRun,
  providerFallback,
  providerGate,
  COMMERCIAL_CLASSES,
  PROVIDER_CATEGORIES,
  loadAmenities,
  createSafeguardState,
} = require("../src/index.cjs");

const focus = {
  precision: "approximate",
  label: "Near Nekede",
  lat: 5.4214,
  lng: 7.0419,
  radiusM: 800,
};

test("the registry wraps the lab gate and keeps OSRM absent", () => {
  assert.equal(COMMERCIAL_CLASSES.length, 5);
  assert.equal(PROVIDER_CATEGORIES.includes("transit"), true);
  const rows = providerRegistry();
  assert.equal(rows.find((row) => row.id === "overpass").commercialUse, "APPROVED_WITH_ATTRIBUTION");
  assert.equal(rows.find((row) => row.id === "overpass").category, "places");
  assert.equal(rows.find((row) => row.id === "weather").commercialUse, "NON_COMMERCIAL");
  assert.equal(rows.find((row) => row.id === "tiles").commercialUse, "UNKNOWN");
  const osrm = rows.find((row) => row.id === "osrm");
  assert.equal(osrm.status, "absent");
  assert.equal(osrm.commercialUse, "NON_COMMERCIAL");
  assert.equal(providerGate("osrm").status, "absent");
});

test("UNKNOWN and NON_COMMERCIAL cannot run in production", () => {
  const registry = [
    { id: "overpass", status: "cleared", commercialUse: "APPROVED_WITH_ATTRIBUTION" },
    { id: "osrm", status: "cleared", commercialUse: "NON_COMMERCIAL" },
    { id: "tiles", status: "cleared", commercialUse: "UNKNOWN" },
    { id: "sketch", status: "cleared", commercialUse: "DEVELOPMENT_ONLY", category: "maps" },
  ];
  assert.equal(providerCanRun("overpass", { registry, production: true }).ok, true);
  assert.equal(providerCanRun("osrm", { registry, production: true }).code, "commercial_class_blocked");
  assert.equal(providerCanRun("tiles", { registry, production: true }).code, "commercial_class_blocked");
  assert.equal(providerCanRun("sketch", { registry, production: true }).code, "commercial_class_blocked");
  assert.equal(providerCanRun("osrm", { registry, production: false }).ok, true);
  assert.equal(providerCanRun("overpass", { registry: [{ id: "overpass", status: "under review" }] }).code, "unconfigured");
});

test("a required key that is missing blocks the provider", () => {
  const registry = [{
    id: "places-commercial",
    status: "cleared",
    category: "places",
    commercialUse: "APPROVED_COMMERCIAL",
    authentication: { required: true, env: "PLACES_API_KEY" },
    fallbackPriority: 1,
  }];
  assert.equal(providerCanRun("places-commercial", { registry, env: {}, production: true }).code, "missing_api_key");
  assert.equal(providerCanRun("places-commercial", { registry, env: { PLACES_API_KEY: "present" }, production: true }).ok, true);
});

test("fallback skips a down provider and keeps the next cleared one", () => {
  const registry = [
    { id: "places-a", status: "cleared", category: "places", commercialUse: "APPROVED_COMMERCIAL", health: "down", fallbackPriority: 1 },
    { id: "places-b", status: "cleared", category: "places", commercialUse: "APPROVED_WITH_ATTRIBUTION", health: "ok", fallbackPriority: 2 },
  ];
  const chain = providerFallback("places", { registry, production: true });
  assert.deepEqual(chain.map((row) => row.id), ["places-b"]);
});

test("a production block does not call the network even when the env url is set", async () => {
  let calls = 0;
  const result = await loadAmenities({
    focus,
    production: true,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: [{ id: "overpass", status: "cleared", commercialUse: "NON_COMMERCIAL" }],
    safeguardState: createSafeguardState(),
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  });
  assert.equal(result.status, "unconfigured");
  assert.equal(calls, 0);
});
