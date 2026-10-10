const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/index.cjs");

const NOW = Date.parse("2026-10-10T12:00:00Z");
const cleared = (id, extra) => Object.assign({ id, status: "cleared", commercialUse: "APPROVED_WITH_ATTRIBUTION" }, extra);

test("12N: Overpass public is DEVELOPMENT_ONLY and never runs in production", () => {
  const registry = [cleared("overpass-public", { commercialUse: "DEVELOPMENT_ONLY", env: "OVERPASS_INTERPRETER_URL" })];
  const env = { OVERPASS_INTERPRETER_URL: "https://x", SPATIAL_PROVIDER_OVERPASS_PUBLIC_ENABLED: "true" };
  assert.equal(core.providerPolicy("overpass-public", { registry, env, production: true }).enabled, false);
  assert.equal(core.providerCanRun("overpass-public", { registry, env, production: true }).ok, false);
});

test("12N: public OSRM not production-approved even if cleared and flagged", () => {
  const registry = [cleared("osrm", { env: "OSRM_BASE_URL" })];
  const env = { OSRM_BASE_URL: "https://x", SPATIAL_PROVIDER_OSRM_ENABLED: "1" };
  const p = core.providerPolicy("osrm", { registry, env, production: true });
  assert.equal(p.policy, "NOT_PRODUCTION_APPROVED");
  assert.equal(p.enabled, false);
  assert.equal(core.providerCanRun("osrm", { registry, env, production: true }).ok, false);
});

test("12N: Google 3D disabled and Mapillary deferred in every runtime", () => {
  for (const id of ["google-photorealistic-3d", "mapillary"]) {
    const registry = [cleared(id, { commercialUse: "APPROVED_COMMERCIAL" })];
    const env = { [core.featureFlagName(id)]: "true", GOOGLE_MAPS_3D_KEY: "k", MAPILLARY_TOKEN: "k" };
    for (const production of [true, false]) {
      assert.equal(core.providerPolicy(id, { registry, env, production }).enabled, false, id);
      assert.equal(core.providerCanRun(id, { registry, env, production }).ok, false, id);
    }
  }
});

test("12N: triple gate requires configured AND commerciallyApproved AND featureEnabled", () => {
  const registry = [cleared("overpass-selfhosted", { env: "OVERPASS_SELFHOSTED_URL" })];
  const base = { OVERPASS_SELFHOSTED_URL: "https://x" };
  const flag = core.featureFlagName("overpass-selfhosted");
  assert.equal(core.providerPolicy("overpass-selfhosted", { registry, env: base, production: true }).enabled, false);
  assert.equal(core.providerPolicy("overpass-selfhosted", { registry, env: Object.assign({ [flag]: "true" }, base), production: true }).enabled, true);
  assert.equal(core.providerPolicy("overpass-selfhosted", { registry, env: { [flag]: "true" }, production: true }).enabled, false);
  const unknown = [cleared("overpass-selfhosted", { commercialUse: "UNKNOWN", env: "OVERPASS_SELFHOSTED_URL" })];
  assert.equal(core.providerPolicy("overpass-selfhosted", { registry: unknown, env: Object.assign({ [flag]: "true" }, base), production: true }).enabled, false);
});

test("12N: shipped registry enables nothing", () => {
  core.providerRegistry().forEach((row) => {
    assert.equal(core.providerPolicy(row.id, { env: {}, production: true }).enabled, false, row.id);
  });
});

test("12K: every status reachable from fixtures, no secrets in reasons", () => {
  const registry = [
    cleared("a"), cleared("b"), cleared("c"), cleared("d"), cleared("e"),
    cleared("k", { authentication: { required: true, env: "K_KEY" } }),
    { id: "u", status: "not connected", commercialUse: "APPROVED_COMMERCIAL" },
    cleared("google-photorealistic-3d"),
  ];
  const state = core.createProviderHealthState();
  const env = { K_KEY: "" };
  core.recordProviderOutcome(state, "a", { ok: true, at: NOW - 1000, latencyMs: 100 });
  for (let i = 0; i < 4; i += 1) core.recordProviderOutcome(state, "b", { ok: i !== 0, at: NOW - 1000, latencyMs: 100 });
  core.recordProviderOutcome(state, "c", { ok: true, at: NOW - 30 * 24 * 3600 * 1000 });
  core.recordProviderOutcome(state, "d", { ok: false, at: NOW - 10, statusCode: 429, backoffUntil: NOW + 60000 });
  for (let i = 0; i < 4; i += 1) core.recordProviderOutcome(state, "e", { ok: false, at: NOW - 10 });
  const opts = { registry, state, env, production: false, now: NOW };
  const s = (id) => core.providerHealth(id, opts).status;
  assert.equal(s("a"), "UP");
  assert.equal(s("b"), "DEGRADED");
  assert.equal(s("c"), "STALE");
  assert.equal(s("d"), "RATE_LIMITED");
  assert.equal(s("e"), "UNAVAILABLE");
  assert.equal(s("k"), "MISSING_KEY");
  assert.equal(s("u"), "UNAVAILABLE");
  assert.equal(s("google-photorealistic-3d"), "DISABLED");
  const all = core.allProviderHealth(opts);
  const text = JSON.stringify(all);
  assert.ok(!/https?:\/\//.test(text));
  assert.ok(!text.includes("K_KEY"));
  all.forEach((h) => {
    ["providerId", "status", "reason", "lastSuccessAt", "lastErrorAt", "latency", "freshness", "backoffUntil", "errorRate", "checkedAt"].forEach((k) => assert.ok(k in h, k));
    assert.ok(core.HEALTH_STATUSES.includes(h.status));
  });
});

test("12K: planning never offers unavailable or rate-limited providers", () => {
  const registry = [
    cleared("p1", { category: "places" }), cleared("p2", { category: "places" }), cleared("p3", { category: "places" }),
  ];
  const env = { SPATIAL_PROVIDER_P1_ENABLED: "1", SPATIAL_PROVIDER_P2_ENABLED: "1", SPATIAL_PROVIDER_P3_ENABLED: "1" };
  const state = core.createProviderHealthState();
  core.recordProviderOutcome(state, "p1", { ok: true, at: NOW });
  core.recordProviderOutcome(state, "p2", { ok: false, at: NOW, statusCode: 429, backoffUntil: NOW + 60000 });
  const plan = core.planProviders("places", { registry, env, state, now: NOW, production: false });
  assert.deepEqual(plan.map((p) => p.providerId), ["p1", "p3"]);
  assert.equal(core.canCallProvider(core.providerHealth("p2", { registry, env, state, now: NOW })), false);
});

test("12K: safeguards record outcomes into health state", async () => {
  const healthState = core.createProviderHealthState();
  const { withProviderSafeguards, createSafeguardState } = require("../src/safeguards.cjs");
  await withProviderSafeguards({ cleared: true, providerId: "z", state: createSafeguardState(), healthState, now: () => NOW },
    async () => ({ statusCode: 429, value: null }));
  const health = core.providerHealth("z", { registry: [cleared("z")], state: healthState, now: NOW, production: false });
  assert.equal(health.status, "RATE_LIMITED");
});

test("12N: Google 3D and Mapillary are listed in the registry as disabled/deferred", () => {
  const rows = core.providerRegistry();
  assert.equal(rows.find((r) => r.id === "google-photorealistic-3d").status, "disabled");
  assert.equal(rows.find((r) => r.id === "mapillary").status, "deferred");
  assert.equal(core.providerHealth("google-photorealistic-3d", { env: {}, production: true }).status, "DISABLED");
  assert.equal(core.providerHealth("mapillary", { env: {}, production: true }).status, "DISABLED");
});
