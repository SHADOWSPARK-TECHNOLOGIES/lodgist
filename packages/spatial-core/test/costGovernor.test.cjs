const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/index.cjs");

const NOW = Date.parse("2026-10-10T12:00:00Z");

test("12L: ALLOW then THROTTLE then DENY at budget exhaustion", async () => {
  const ledger = core.createMemoryCostLedger();
  const req = { provider: "p", tenant: "t", agent: "a", budget: { maxRequests: 5 }, now: NOW };
  const out = [];
  for (let i = 0; i < 6; i += 1) out.push((await core.governProviderCall(ledger, req)).decision);
  assert.deepEqual(out, ["ALLOW", "ALLOW", "ALLOW", "THROTTLE", "THROTTLE", "DENY"]);
});

test("12L: FALLBACK when exhausted and a fallback exists; fallbackCalls counted", async () => {
  const ledger = core.createMemoryCostLedger();
  const req = { provider: "p", budget: { maxRequests: 1 }, fallbackAvailable: true, now: NOW };
  assert.equal((await core.governProviderCall(ledger, req)).decision, "THROTTLE");
  const second = await core.governProviderCall(ledger, req);
  assert.equal(second.decision, "FALLBACK");
  assert.equal(second.used.fallbackCalls, 1);
});

test("12L: paid provider with unknown budget is denied", async () => {
  const ledger = core.createMemoryCostLedger();
  assert.equal((await core.governProviderCall(ledger, { provider: "paid", paid: true, now: NOW })).decision, "DENY");
});

test("12L: cache hits do not spend budget", async () => {
  const ledger = core.createMemoryCostLedger();
  const req = { provider: "p", budget: { maxRequests: 1 }, now: NOW };
  for (let i = 0; i < 3; i += 1) await core.governProviderCall(ledger, Object.assign({ cacheHit: true }, req));
  const r = await core.governProviderCall(ledger, req);
  assert.equal(r.decision, "THROTTLE");
  assert.equal(r.used.cacheHits, 3);
});

test("12L: cost budget and keys by provider+tenant+agent+window", async () => {
  const ledger = core.createMemoryCostLedger();
  const req = { provider: "p", tenant: "t", agent: "x", budget: { maxCost: 1 }, estimatedCost: 0.6, now: NOW };
  assert.equal((await core.governProviderCall(ledger, req)).decision, "ALLOW");
  assert.equal((await core.governProviderCall(ledger, req)).decision, "DENY");
  assert.equal((await core.governProviderCall(ledger, Object.assign({}, req, { agent: "y" }))).decision, "ALLOW");
  assert.equal((await core.governProviderCall(ledger, Object.assign({}, req, { now: NOW + 86400000 }))).decision, "ALLOW");
  const scope = core.costScope({ provider: "p", tenant: "t", agent: "x" }, NOW);
  assert.equal(core.costKey(scope), "p|t|x|2026-10-10T00:00:00.000Z");
});
