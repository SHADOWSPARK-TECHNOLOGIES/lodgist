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
  const publicOverpass = rows.find((row) => row.id === "overpass-public");
  const selfHosted = rows.find((row) => row.id === "overpass-selfhosted");
  assert.equal(rows.some((row) => row.id === "overpass"), false);
  assert.equal(publicOverpass.commercialUse, "DEVELOPMENT_ONLY");
  assert.equal(publicOverpass.category, "places");
  assert.equal(publicOverpass.status, "under review");
  assert.equal(publicOverpass.termsUrl, "https://dev.overpass-api.de/overpass-doc/en/preface/commons.html");
  assert.equal(selfHosted.commercialUse, "APPROVED_WITH_ATTRIBUTION");
  assert.equal(selfHosted.license, "ODbL-1.0");
  assert.equal(selfHosted.status, "not connected");
  assert.equal(selfHosted.termsUrl, "https://opendatacommons.org/licenses/odbl/1-0/");
  assert.equal(rows.find((row) => row.id === "weather").commercialUse, "NON_COMMERCIAL");
  assert.equal(rows.find((row) => row.id === "tiles").commercialUse, "UNKNOWN");
  for (const row of rows) {
    assert.equal(typeof row.termsCheckedAt, "string");
    assert.match(row.termsCheckedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.termsUrl === null || typeof row.termsUrl === "string");
  }
  const osrm = rows.find((row) => row.id === "osrm");
  assert.equal(osrm.status, "absent");
  assert.equal(osrm.commercialUse, "NON_COMMERCIAL");
  assert.equal(osrm.termsUrl, "https://www.openstreetmap.org/copyright");
  assert.equal(providerGate("osrm").status, "absent");
  assert.equal(providerGate("overpass").status, "absent");
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
  assert.equal(providerCanRun("overpass-public", {
    registry: [{ id: "overpass-public", status: "cleared", commercialUse: "DEVELOPMENT_ONLY" }],
    production: true,
  }).code, "commercial_class_blocked");
  assert.equal(providerCanRun("overpass-selfhosted", {
    registry: [{ id: "overpass-selfhosted", status: "cleared", commercialUse: "APPROVED_WITH_ATTRIBUTION" }],
    production: true,
  }).ok, true);
  assert.equal(providerCanRun("overpass-selfhosted", { production: true }).code, "unconfigured");
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

test("a cleared public Overpass instance does not run in production", async () => {
  let calls = 0;
  const result = await loadAmenities({
    focus,
    production: true,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: [{ id: "overpass-public", status: "cleared", commercialUse: "DEVELOPMENT_ONLY" }],
    safeguardState: createSafeguardState(),
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  });
  assert.equal(result.status, "unconfigured");
  assert.equal(calls, 0);
});

test("self-hosted Overpass stays dark until configured and does not fall through to the public instance", async () => {
  let calls = 0;
  const blocked = await loadAmenities({
    focus,
    env: {
      OVERPASS_SELFHOSTED_URL: "https://overpass.internal/interpreter",
      OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter",
    },
    safeguardState: createSafeguardState(),
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  });
  assert.equal(blocked.status, "unconfigured");
  assert.equal(calls, 0);

  let url = "";
  const allowed = await loadAmenities({
    focus,
    production: true,
    env: {
      OVERPASS_SELFHOSTED_URL: "https://overpass.internal/interpreter",
      OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter",
    },
    registry: [{ id: "overpass-selfhosted", status: "cleared", commercialUse: "APPROVED_WITH_ATTRIBUTION" }],
    lookup: async () => [{ address: "1.1.1.1", family: 4 }],
    safeguardState: createSafeguardState(),
    fetchImpl: async (called) => {
      url = called;
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  });
  assert.equal(allowed.status, "empty");
  assert.equal(url, "https://overpass.internal/interpreter");
  assert.equal(calls, 1);
});
