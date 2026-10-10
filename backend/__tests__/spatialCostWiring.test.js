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
