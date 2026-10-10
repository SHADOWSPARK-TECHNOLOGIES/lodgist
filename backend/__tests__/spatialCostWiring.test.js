const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const createSpatialRouter = require("../src/routes/spatial");
const { createSafeguardState } = require("../../packages/spatial-core/src/safeguards.cjs");
const { createResilientCostLedger, createGovernedFetch } = require("../src/services/spatialCostGovernor");

const NOW = Date.parse("2026-10-10T12:00:00Z");
const SELF = "https://overpass.self.example/api/interpreter";
const PUB = "https://overpass.public.example/api/interpreter";
const OSRM = "https://osrm.example";
const env = { OVERPASS_SELFHOSTED_URL: SELF, OVERPASS_FALLBACK_URL: PUB, OSRM_BASE_URL: OSRM };
const cleared = (id, extra) => Object.assign({ id, status: "cleared", commercialUse: "APPROVED_WITH_ATTRIBUTION" }, extra);
const registry = [
  cleared("overpass-selfhosted", { env: "OVERPASS_SELFHOSTED_URL" }),
  cleared("overpass-public", { env: "OVERPASS_INTERPRETER_URL" }),
  cleared("osrm", { env: "OSRM_BASE_URL" }),
];
const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
const home = {
  id: 42, title: "Flat near Nekede", public: true,
  property: { lga: "Owerri West", city: "Owerri", state: "Imo" },
  approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
};
const overpassBody = { elements: [{ type: "node", id: 1, lat: 5.4951, lon: 7.0351, tags: { amenity: "pharmacy", name: "Chemist" } }] };

function fakePrisma() {
  const rows = new Map();
  const key = (w) => { const k = w.provider_tenant_agent_windowStart; return [k.provider, k.tenant, k.agent, k.windowStart.toISOString()].join("|"); };
  return {
    rows,
    calls: 0,
    spatialCostLedger: {
      async findUnique({ where }) { return rows.get(key(where)) || null; },
      async upsert({ where, create, update }) {
        const k = key(where);
        const row = rows.get(k);
        if (!row) { rows.set(k, Object.assign({}, create)); return rows.get(k); }
        Object.keys(update).forEach((f) => { row[f] += update[f].increment; });
        return row;
      },
    },
  };
}

function missingTablePrisma() {
  const err = () => Object.assign(new Error('The table `public.SpatialCostLedger` does not exist in the current database.'), { code: "P2021" });
  return { spatialCostLedger: { async findUnique() { throw err(); }, async upsert() { throw err(); } } };
}

function recordingFetch() {
  const urls = [];
  const fn = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify(overpassBody), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  fn.urls = urls;
  return fn;
}

async function callNearby(options) {
  const app = express();
  app.use(express.json());
  app.use("/api/spatial", createSpatialRouter(Object.assign({
    env, registry, lookup, production: false, loadListing: async () => home, now: () => NOW, safeguardState: createSafeguardState(),
  }, options)));
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/spatial/tool`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "lodgist.nearby_amenities", input: { listingId: 42 } }),
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

function ledgerRow(prisma, provider) {
  return [...prisma.rows.values()].find((row) => row.provider === provider) || null;
}

test("provider calls from /api/spatial/tool are recorded in the Prisma SpatialCostLedger", async () => {
  const prisma = fakePrisma();
  const fetchImpl = recordingFetch();
  const { status, body } = await callNearby({ prisma, fetchImpl });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  assert.deepEqual(fetchImpl.urls, [SELF]);
  const row = ledgerRow(prisma, "overpass-selfhosted");
  assert.ok(row, "ledger row written");
  assert.equal(row.requests, 1);
  assert.equal(row.tenant, "lodgist");
  assert.equal(row.window, "day");
});

test("DENY stops the provider call and the network is never touched", async () => {
  const prisma = fakePrisma();
  const fetchImpl = recordingFetch();
  const onlySelf = { OVERPASS_SELFHOSTED_URL: SELF };
  const { body } = await callNearby({ prisma, fetchImpl, env: onlySelf, costBudgets: { "overpass-selfhosted": { maxRequests: 0 } } });
  assert.equal(body.ok, false);
  assert.equal(fetchImpl.urls.length, 0);
  const row = ledgerRow(prisma, "overpass-selfhosted");
  assert.equal(row.requests, 0);
});

test("a paid provider with no known budget is denied", async () => {
  const prisma = fakePrisma();
  const fetchImpl = recordingFetch();
  const { body } = await callNearby({ prisma, fetchImpl, env: { OVERPASS_SELFHOSTED_URL: SELF }, costPaid: { "overpass-selfhosted": true } });
  assert.equal(body.ok, false);
  assert.equal(fetchImpl.urls.length, 0);
});

test("FALLBACK switches to the next configured provider and records both", async () => {
  const prisma = fakePrisma();
  const fetchImpl = recordingFetch();
  const { status, body } = await callNearby({ prisma, fetchImpl, costBudgets: { "overpass-selfhosted": { maxRequests: 0 } } });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  assert.deepEqual(fetchImpl.urls, [PUB]);
  assert.equal(ledgerRow(prisma, "overpass-selfhosted").fallbackCalls, 1);
  assert.equal(ledgerRow(prisma, "overpass-public").requests, 1);
});

test("FALLBACK never reaches a provider that core policy forbids (production)", async () => {
  const prisma = fakePrisma();
  const fetchImpl = recordingFetch();
  // overpass-public is DEVELOPMENT_ONLY, so in production there is no fallback: DENY.
  const prodRegistry = [cleared("overpass-selfhosted", { env: "OVERPASS_SELFHOSTED_URL" }), cleared("overpass-public", { env: "OVERPASS_INTERPRETER_URL" })];
  const { body } = await callNearby({ prisma, fetchImpl, production: true, registry: prodRegistry, costBudgets: { "overpass-selfhosted": { maxRequests: 0 } } });
  assert.equal(body.ok, false);
  assert.equal(fetchImpl.urls.length, 0);
});

test("THROTTLE still calls the provider and is metered", async () => {
  const ledger = createResilientCostLedger(fakePrisma());
  const fetchImpl = recordingFetch();
  const governed = createGovernedFetch(fetchImpl, { env, registry, ledger, budgets: { osrm: { maxRequests: 2 } }, now: () => NOW });
  await governed(`${OSRM}/route/v1/driving/1,2;3,4`, {});
  await governed(`${OSRM}/route/v1/driving/1,2;3,4`, {});
  await assert.rejects(governed(`${OSRM}/route/v1/driving/1,2;3,4`, {}), (e) => e.code === "budget_denied");
  assert.deepEqual(governed.decisions.map((d) => d.decision), ["ALLOW", "THROTTLE", "DENY"]);
  assert.equal(fetchImpl.urls.length, 2);
});

test("a host that matches no configured provider is denied", async () => {
  const ledger = createResilientCostLedger(null);
  const fetchImpl = recordingFetch();
  const governed = createGovernedFetch(fetchImpl, { env, registry, ledger });
  await assert.rejects(governed("https://evil.example/x", {}), (e) => e.code === "budget_denied");
  assert.equal(fetchImpl.urls.length, 0);
});

test("a missing SpatialCostLedger table degrades to the in-memory ledger without crashing", async () => {
  const logs = [];
  const prisma = missingTablePrisma();
  const ledger = createResilientCostLedger(prisma, { log: (e) => logs.push(e) });
  assert.equal(ledger.mode, "prisma");
  const fetchImpl = recordingFetch();
  const first = await callNearby({ prisma, fetchImpl, costLedger: ledger });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.ok, true);
  assert.equal(ledger.mode, "memory");
  assert.equal(ledger.reason, "table_missing");
  assert.equal(logs[0].event, "spatial_cost_ledger_degraded");
  // Budgets are still enforced from the in-memory ledger after degrading.
  const usage = [...ledger.memory.rows.values()][0];
  assert.equal(usage.requests, 1);
});

test("the router builds its own ledger from prisma and survives a missing delegate", async () => {
  const fetchImpl = recordingFetch();
  const { status, body } = await callNearby({ prisma: {}, fetchImpl });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  const missing = await callNearby({ prisma: missingTablePrisma(), fetchImpl: recordingFetch() });
  assert.equal(missing.status, 200);
  assert.equal(missing.body.ok, true);
});

/* ---- Provenance follows the provider that actually served the data ---- */

test("FALLBACK provenance names the fallback provider, its commercial class and attribution, never the primary", async () => {
  const prisma = fakePrisma();
  const fetchImpl = recordingFetch();
  const { status, body } = await callNearby({ prisma, fetchImpl, costBudgets: { "overpass-selfhosted": { maxRequests: 0 } } });
  assert.equal(status, 200, JSON.stringify(body));
  assert.deepEqual(fetchImpl.urls, [PUB]);
  assert.equal(body.provenance.provider, "overpass-public");
  assert.equal(body.provenance.fallbackFrom, "overpass-selfhosted");
  assert.equal(body.provenance.commercialUse, "APPROVED_WITH_ATTRIBUTION");
  assert.equal(body.provenance.attribution, "© OpenStreetMap contributors");
  assert.deepEqual(body.servedBy, {
    provider: "overpass-public",
    requestedProvider: "overpass-selfhosted",
    fallback: true,
    commercialUse: "APPROVED_WITH_ATTRIBUTION",
    attribution: "© OpenStreetMap contributors",
  });
  assert.ok(body.warnings.some((w) => /fallback/i.test(w) && w.includes("overpass-public")));
  assert.ok(body.dataQuality.warnings.some((w) => /fallback/i.test(w)), "dataQuality carries the fallback warning");
  assert.ok(body.dataQuality.ruleIds.includes("dq.provider.fallback"));
  assert.equal(body.dataQuality.servedBy, "overpass-public");
  assert.equal(body.dataQuality.commercialUse, "APPROVED_WITH_ATTRIBUTION");
  assert.equal(body.dataQuality.attribution, "© OpenStreetMap contributors");
  // The primary is never named as the source of fallback data anywhere except as fallbackFrom/requestedProvider.
  const scrubbed = JSON.stringify(Object.assign({}, body, {
    servedBy: Object.assign({}, body.servedBy, { requestedProvider: null }),
    provenance: Object.assign({}, body.provenance, { fallbackFrom: null }),
    warnings: [], dataQuality: null,
  }));
  assert.ok(!scrubbed.includes("overpass-selfhosted"), scrubbed);
});

test("FALLBACK uses the fallback row's own commercial class (default registry: DEVELOPMENT_ONLY)", async () => {
  const fetchImpl = recordingFetch();
  const reg = [cleared("overpass-selfhosted", { env: "OVERPASS_SELFHOSTED_URL" }), { id: "overpass-public", status: "cleared", env: "OVERPASS_INTERPRETER_URL" }];
  const { body } = await callNearby({ prisma: fakePrisma(), fetchImpl, registry: reg, costBudgets: { "overpass-selfhosted": { maxRequests: 0 } } });
  assert.equal(body.ok, true, JSON.stringify(body));
  assert.equal(body.provenance.provider, "overpass-public");
  assert.equal(body.provenance.commercialUse, "DEVELOPMENT_ONLY");
  assert.equal(body.servedBy.commercialUse, "DEVELOPMENT_ONLY");
  assert.equal(body.dataQuality.commercialUse, "DEVELOPMENT_ONLY");
});

test("a direct (non-fallback) call is attributed to the primary with no fallback warning", async () => {
  const fetchImpl = recordingFetch();
  const { body } = await callNearby({ prisma: fakePrisma(), fetchImpl });
  assert.equal(body.provenance.provider, "overpass-selfhosted");
  assert.equal(body.provenance.fallbackFrom, null);
  assert.equal(body.servedBy.fallback, false);
  assert.equal(body.dataQuality.servedBy, "overpass-selfhosted");
  assert.ok(!body.dataQuality.ruleIds.includes("dq.provider.fallback"));
  assert.ok(!(body.warnings || []).some((w) => /fallback/i.test(w)));
});

test("attributeServedProvider: any fallback served record overrides a primary-named envelope", () => {
  const { attributeServedProvider } = require("../src/services/spatialCostGovernor");
  const raw = { ok: true, provenance: { provider: "overpass-selfhosted", attribution: "primary", source: "OpenStreetMap" } };
  const out = attributeServedProvider(raw, [{ requested: "overpass-selfhosted", servedBy: "overpass-public", fallback: true }], { registry });
  assert.equal(out.provenance.provider, "overpass-public");
  assert.notEqual(out.provenance.attribution, "primary");
  assert.equal(out.servedBy.provider, "overpass-public");
  assert.equal(raw.provenance.provider, "overpass-selfhosted", "input not mutated");
});

/* ---- Cache hits are metered at zero cost ---- */

test("a spatial-core cache hit is recorded in the ledger with zero cost and no provider request", async () => {
  const prisma = fakePrisma();
  const fetchImpl = recordingFetch();
  const safeguardState = createSafeguardState();
  const first = await callNearby({ prisma, fetchImpl, safeguardState });
  assert.equal(first.body.ok, true);
  const second = await callNearby({ prisma, fetchImpl, safeguardState });
  assert.equal(second.body.ok, true, JSON.stringify(second.body));
  assert.equal(fetchImpl.urls.length, 1, "second call served from cache");
  const row = ledgerRow(prisma, "overpass-selfhosted");
  assert.equal(row.requests, 1);
  assert.equal(row.cacheHits, 1);
  assert.equal(Number(row.estimatedCost), 0);
  await callNearby({ prisma, fetchImpl, safeguardState });
  assert.equal(ledgerRow(prisma, "overpass-selfhosted").cacheHits, 2);
  assert.equal(ledgerRow(prisma, "overpass-selfhosted").requests, 1);
});

test("cache hits do not consume request budget", async () => {
  const prisma = fakePrisma();
  const fetchImpl = recordingFetch();
  const safeguardState = createSafeguardState();
  const opts = { prisma, fetchImpl, safeguardState, env: { OVERPASS_SELFHOSTED_URL: SELF }, costBudgets: { "overpass-selfhosted": { maxRequests: 1 } }, costEstimates: { "overpass-selfhosted": 5 } };
  assert.equal((await callNearby(opts)).body.ok, true);
  for (let i = 0; i < 3; i += 1) assert.equal((await callNearby(opts)).body.ok, true);
  const row = ledgerRow(prisma, "overpass-selfhosted");
  assert.equal(row.requests, 1);
  assert.equal(Number(row.estimatedCost), 5);
  assert.equal(row.cacheHits, 3);
});

test("a cold call records no cache hit", async () => {
  const prisma = fakePrisma();
  await callNearby({ prisma, fetchImpl: recordingFetch() });
  assert.equal(ledgerRow(prisma, "overpass-selfhosted").cacheHits, 0);
});
