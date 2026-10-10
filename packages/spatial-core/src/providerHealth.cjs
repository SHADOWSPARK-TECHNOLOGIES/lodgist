/**
 * Phase 12K provider health. Read-only status used by agent planning so an
 * agent never repeatedly calls an unavailable provider. Reasons never carry
 * secrets, URLs or keys. Pattern: GEV F45 loading feedback + safeguards backoff.
 */
const { providerRegistry, providerCanRun, providerPolicy } = require("./registry.cjs");
const { finiteTimestamp } = require("./evidence.cjs");

const HEALTH_STATUSES = Object.freeze(["UP", "DEGRADED", "STALE", "RATE_LIMITED", "MISSING_KEY", "UNAVAILABLE", "DISABLED"]);
const CALLABLE = new Set(["UP", "DEGRADED", "STALE"]);
const DEGRADED_ERROR_RATE = 0.2;
const UNAVAILABLE_ERROR_RATE = 0.5;
const SLOW_LATENCY_MS = 5000;
const MIN_SAMPLE = 4;

function createProviderHealthState() {
  return { records: new Map() };
}

function recordOf(state, id) {
  if (!state.records.has(id)) {
    state.records.set(id, { requests: 0, errors: 0, lastSuccessAt: null, lastErrorAt: null, latencyMs: null, backoffUntil: null });
  }
  return state.records.get(id);
}

/** outcome: {ok:boolean, at:number, latencyMs?, statusCode?, backoffUntil?} */
function recordProviderOutcome(state, providerId, outcome = {}) {
  if (!state || !providerId) return null;
  const row = recordOf(state, providerId);
  const at = finiteTimestamp(outcome.at) || Date.now();
  row.requests += 1;
  if (outcome.ok) row.lastSuccessAt = at;
  else {
    row.errors += 1;
    row.lastErrorAt = at;
  }
  if (typeof outcome.latencyMs === "number" && outcome.latencyMs >= 0) row.latencyMs = outcome.latencyMs;
  if (outcome.statusCode === 429 || outcome.statusCode === 406) {
    row.backoffUntil = finiteTimestamp(outcome.backoffUntil) || at + 30 * 1000;
  } else if (finiteTimestamp(outcome.backoffUntil)) {
    row.backoffUntil = finiteTimestamp(outcome.backoffUntil);
  }
  return Object.assign({}, row);
}

function iso(ms) {
  return ms == null ? null : new Date(ms).toISOString();
}

function providerHealth(providerId, options = {}) {
  const now = finiteTimestamp(typeof options.now === "function" ? options.now() : options.now) || Date.now();
  const state = options.state || createProviderHealthState();
  const record = state.records.get(providerId) || { requests: 0, errors: 0, lastSuccessAt: null, lastErrorAt: null, latencyMs: null, backoffUntil: null };
  const row = providerRegistry(options.registry).find((item) => item.id === providerId) || null;
  const policy = providerPolicy(providerId, options);
  const gate = providerCanRun(providerId, options);
  const errorRate = record.requests ? Math.round((record.errors / record.requests) * 1000) / 1000 : null;
  const staleAfterMs = row && row.freshnessPolicy && row.freshnessPolicy.staleAfterMs;
  let status;
  let reason;
  if (!row || policy.policy === "DISABLED" || policy.policy === "DEFERRED" || gate.code === "policy_blocked" || gate.code === "commercial_class_blocked") {
    status = "DISABLED";
    reason = policy.reason || (gate.code === "commercial_class_blocked" ? "commercial class not approved for production" : "provider not registered");
  } else if (gate.code === "missing_api_key") {
    status = "MISSING_KEY";
    reason = "required credential is not configured";
  } else if (!gate.ok) {
    status = "UNAVAILABLE";
    reason = gate.code === "unconfigured" ? "provider not configured or not cleared" : "provider marked down";
  } else if (record.backoffUntil && record.backoffUntil > now) {
    status = "RATE_LIMITED";
    reason = "provider asked us to back off";
  } else if (record.requests >= MIN_SAMPLE && errorRate >= UNAVAILABLE_ERROR_RATE) {
    status = "UNAVAILABLE";
    reason = "recent error rate too high";
  } else if ((record.requests >= MIN_SAMPLE && errorRate >= DEGRADED_ERROR_RATE) || (record.latencyMs != null && record.latencyMs > SLOW_LATENCY_MS)) {
    status = "DEGRADED";
    reason = "elevated errors or latency";
  } else if (!record.lastSuccessAt || (staleAfterMs && now - record.lastSuccessAt > staleAfterMs)) {
    status = "STALE";
    reason = record.lastSuccessAt ? "last success older than freshness policy" : "no successful call recorded";
  } else {
    status = "UP";
    reason = null;
  }
  return {
    providerId,
    status,
    reason,
    lastSuccessAt: iso(record.lastSuccessAt),
    lastErrorAt: iso(record.lastErrorAt),
    latency: record.latencyMs,
    freshness: !record.lastSuccessAt ? "UNKNOWN" : (staleAfterMs && now - record.lastSuccessAt > staleAfterMs ? "STALE" : "FRESH"),
    backoffUntil: record.backoffUntil && record.backoffUntil > now ? iso(record.backoffUntil) : null,
    errorRate,
    checkedAt: iso(now),
  };
}

function allProviderHealth(options = {}) {
  return providerRegistry(options.registry).map((row) => providerHealth(row.id, options));
}

function canCallProvider(health) {
  return Boolean(health && CALLABLE.has(health.status));
}

/** Agent planning: usable providers for a category, healthiest first. Never lists unavailable ones. */
function planProviders(category, options = {}) {
  const rank = { UP: 0, STALE: 1, DEGRADED: 2 };
  return providerRegistry(options.registry)
    .filter((row) => row.category === category)
    .map((row) => ({ row, health: providerHealth(row.id, options), policy: providerPolicy(row.id, options) }))
    .filter((item) => canCallProvider(item.health) && item.policy.enabled)
    .sort((a, b) => (rank[a.health.status] - rank[b.health.status]) || ((a.row.fallbackPriority || 100) - (b.row.fallbackPriority || 100)))
    .map((item) => ({ providerId: item.row.id, status: item.health.status }));
}

module.exports = {
  HEALTH_STATUSES,
  createProviderHealthState,
  recordProviderOutcome,
  providerHealth,
  allProviderHealth,
  canCallProvider,
  planProviders,
};
