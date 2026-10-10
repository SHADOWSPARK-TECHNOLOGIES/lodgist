const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const spatial = require("../../packages/spatial-core");
const { createPrismaCostLedger } = require("../src/services/spatialCostLedgerStore");
const createSpatialRouter = require("../src/routes/spatial");

const migrationPath = path.resolve(__dirname, "../../packages/db/prisma/migrations/20261010200000_spatial_cost_ledger/migration.sql");

test("the cost ledger migration is additive only", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.equal(/\bALTER\s+TABLE\b/i.test(sql), false);
  assert.equal(/\bDROP\b/i.test(sql), false);
  assert.equal(/^\s*(UPDATE|DELETE)\b/im.test(sql), false);
  assert.ok(sql.includes('CREATE TABLE "SpatialCostLedger"'));
  ["User", "Listing", "Booking", "Property", "SpatialMonitor\""].forEach((name) => assert.equal(sql.includes(`"${name}"`), false, name));
});

function fakePrisma() {
  const rows = new Map();
  const key = (w) => { const k = w.provider_tenant_agent_windowStart; return [k.provider, k.tenant, k.agent, k.windowStart.toISOString()].join("|"); };
  return {
    rows,
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

test("cost governor decisions persist through the Prisma ledger", async () => {
  const prisma = fakePrisma();
  const req = { provider: "p", tenant: "t", agent: "a", budget: { maxRequests: 2 }, now: Date.parse("2026-10-10T12:00:00Z") };
  const first = await spatial.governProviderCall(createPrismaCostLedger(prisma), req);
  assert.equal(first.decision, "ALLOW");
  // a fresh ledger object over the same store sees the persisted usage
  const second = await spatial.governProviderCall(createPrismaCostLedger(prisma), req);
  assert.equal(second.decision, "THROTTLE");
  const third = await spatial.governProviderCall(createPrismaCostLedger(prisma), req);
  assert.equal(third.decision, "DENY");
  assert.equal(prisma.rows.size, 1);
});

test("GET /api/spatial/providers/health is flag-gated and leaks no secrets", async () => {
  for (const flag of ["", "true"]) {
    const app = express();
    app.use("/api/spatial", createSpatialRouter({ env: { SPATIAL_PROVIDER_HEALTH: flag, MAPILLARY_TOKEN: "sekret-token" }, production: true }));
    const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/spatial/providers/health`);
    const text = await res.text();
    server.close();
    const body = JSON.parse(text);
    assert.equal(body.code, flag ? "ok" : "flag_off");
    assert.ok(!text.includes("sekret-token"));
    if (flag) {
      const g = body.providers.find((p) => p.providerId === "google-photorealistic-3d");
      assert.equal(g.status, "DISABLED");
      assert.ok(body.providers.every((p) => p.status !== "UP"));
    }
  }
});
