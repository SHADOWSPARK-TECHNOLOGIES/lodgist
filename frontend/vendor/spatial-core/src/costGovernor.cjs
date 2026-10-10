/**
 * Phase 12L persisted cost governor. Usage rows are keyed by
 * provider + tenant + agent + window and live in a durable ledger
 * (backend SpatialCostLedger table); the in-memory ledger is for tests and
 * local runs only. Decisions: ALLOW / THROTTLE / DENY / FALLBACK.
 * A paid provider with an unknown budget is always denied. No billing change.
 */
const COST_DECISIONS = Object.freeze(["ALLOW", "THROTTLE", "DENY", "FALLBACK"]);
const DEFAULT_WINDOW = "day";
const THROTTLE_RATIO = 0.8;

function windowStart(at, window) {
  const d = new Date(at);
  if (window === "hour") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours())).toISOString();
  if (window === "month") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

function costScope(input = {}, now = Date.now()) {
  const window = ["hour", "day", "month"].includes(input.window) ? input.window : DEFAULT_WINDOW;
  return {
    provider: String(input.provider || "unknown"),
    tenant: String(input.tenant || "lodgist"),
    agent: String(input.agent || "default"),
    window,
    windowStart: windowStart(now, window),
  };
}

function costKey(scope) {
  return [scope.provider, scope.tenant, scope.agent, scope.windowStart].join("|");
}

function emptyUsage() {
  return { requests: 0, estimatedCost: 0, cacheHits: 0, fallbackCalls: 0 };
}

/**
 * budget: {maxRequests?, maxCost?, known?:boolean}; paid: provider costs money.
 */
function costDecision(input = {}) {
  const usage = Object.assign(emptyUsage(), input.usage || {});
  const budget = input.budget || {};
  const paid = input.paid === true;
  const known = budget.known !== false && (Number.isFinite(budget.maxRequests) || Number.isFinite(budget.maxCost));
  const cost = Number.isFinite(input.estimatedCost) ? input.estimatedCost : 0;
  const fallback = input.fallbackAvailable === true;
  const base = { scope: input.scope || null, budget: known ? { maxRequests: budget.maxRequests ?? null, maxCost: budget.maxCost ?? null } : null, used: usage };
  if (input.cacheHit === true) return Object.assign(base, { decision: "ALLOW", reason: "served from cache; no provider call" });
  if (paid && !known) return Object.assign(base, { decision: fallback ? "FALLBACK" : "DENY", reason: "paid provider with unknown budget" });
  if (!known) return Object.assign(base, { decision: "ALLOW", reason: "free provider; no budget configured" });
  const ratios = [];
  if (Number.isFinite(budget.maxRequests) && budget.maxRequests > 0) ratios.push((usage.requests + 1) / budget.maxRequests);
  if (Number.isFinite(budget.maxCost) && budget.maxCost > 0) ratios.push((usage.estimatedCost + cost) / budget.maxCost);
  if ((Number.isFinite(budget.maxRequests) && budget.maxRequests <= 0) || (Number.isFinite(budget.maxCost) && budget.maxCost <= 0)) ratios.push(Infinity);
  const ratio = ratios.length ? Math.max(...ratios) : 0;
  if (ratio > 1) return Object.assign(base, { decision: fallback ? "FALLBACK" : "DENY", reason: "budget exhausted for window" });
  if (ratio >= THROTTLE_RATIO) return Object.assign(base, { decision: "THROTTLE", reason: "budget nearly exhausted" });
  return Object.assign(base, { decision: "ALLOW", reason: "within budget" });
}

/** In-memory ledger with the same async interface as the backend Prisma ledger. */
function createMemoryCostLedger() {
  const rows = new Map();
  return {
    async read(scope) {
      return Object.assign(emptyUsage(), rows.get(costKey(scope)) || {});
    },
    async add(scope, delta) {
      const current = Object.assign(emptyUsage(), rows.get(costKey(scope)) || {});
      Object.keys(emptyUsage()).forEach((key) => { current[key] += Number(delta[key]) || 0; });
      rows.set(costKey(scope), current);
      return Object.assign({}, current);
    },
    rows,
  };
}

/** Read usage, decide, and persist the outcome. Only ledger.read/add are used. */
async function governProviderCall(ledger, request = {}) {
  const now = typeof request.now === "number" ? request.now : Date.now();
  const scope = costScope(request, now);
  const usage = await ledger.read(scope);
  const decision = costDecision({
    scope, usage, budget: request.budget, paid: request.paid, estimatedCost: request.estimatedCost,
    fallbackAvailable: request.fallbackAvailable, cacheHit: request.cacheHit,
  });
  const delta = emptyUsage();
  if (request.cacheHit === true) delta.cacheHits = 1;
  else if (decision.decision === "ALLOW" || decision.decision === "THROTTLE") {
    delta.requests = 1;
    delta.estimatedCost = Number.isFinite(request.estimatedCost) ? request.estimatedCost : 0;
  } else if (decision.decision === "FALLBACK") delta.fallbackCalls = 1;
  const used = await ledger.add(scope, delta);
  return Object.assign(decision, { scope, used, window: scope.window });
}

module.exports = {
  COST_DECISIONS,
  THROTTLE_RATIO,
  costScope,
  costKey,
  costDecision,
  createMemoryCostLedger,
  governProviderCall,
};
