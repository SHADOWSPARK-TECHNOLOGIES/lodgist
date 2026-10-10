const { randomUUID } = require("crypto");

const FIELDS = ["requests", "estimatedCost", "cacheHits", "fallbackCalls"];

function usageOf(row) {
  const out = { requests: 0, estimatedCost: 0, cacheHits: 0, fallbackCalls: 0 };
  if (!row) return out;
  FIELDS.forEach((key) => { out[key] = Number(row[key]) || 0; });
  return out;
}

function whereOf(scope) {
  return {
    provider_tenant_agent_windowStart: {
      provider: scope.provider,
      tenant: scope.tenant,
      agent: scope.agent,
      windowStart: new Date(scope.windowStart),
    },
  };
}

/** Durable ledger for spatial-core governProviderCall (read/add interface). */
function createPrismaCostLedger(prisma) {
  return {
    async read(scope) {
      const row = await prisma.spatialCostLedger.findUnique({ where: whereOf(scope) });
      return usageOf(row);
    },
    async add(scope, delta) {
      const increment = {};
      FIELDS.forEach((key) => { increment[key] = { increment: Number(delta[key]) || 0 }; });
      const create = {
        id: randomUUID(),
        provider: scope.provider,
        tenant: scope.tenant,
        agent: scope.agent,
        window: scope.window,
        windowStart: new Date(scope.windowStart),
      };
      FIELDS.forEach((key) => { create[key] = Number(delta[key]) || 0; });
      const row = await prisma.spatialCostLedger.upsert({ where: whereOf(scope), create, update: increment });
      return usageOf(row);
    },
  };
}

module.exports = { createPrismaCostLedger };
