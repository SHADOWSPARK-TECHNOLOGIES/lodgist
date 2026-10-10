const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DAILY_BUDGET = 200;
const PROVIDER_BACKOFF_MS = 30 * 1000;
const BACKOFF_STATUSES = new Set([429, 406]);
const DEFAULT_USER_AGENT = "Lodgist/spatial-core (+https://lodgist.online)";

function createSafeguardState() {
  return {
    cache: new Map(),
    tails: new Map(),
    backoffUntil: new Map(),
    budget: new Map(),
  };
}

const defaultSafeguardState = createSafeguardState();

function envObject(input) {
  if (input && Object.prototype.hasOwnProperty.call(input, "env")) {
    return input.env && typeof input.env === "object" ? input.env : {};
  }
  return process.env;
}

function envString(source, name) {
  const value = source ? source[name] : "";
  return typeof value === "string" ? value.trim() : "";
}

function resolveTtl(source, override) {
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) return override;
  const raw = envString(source, "SPATIAL_CACHE_TTL_MS");
  if (!raw) return DEFAULT_CACHE_TTL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CACHE_TTL_MS;
  return parsed;
}

function resolveBudget(source, providerId, override) {
  if (typeof override === "number" && Number.isInteger(override) && override > 0) return override;
  const raw = envString(source, `SPATIAL_DAILY_BUDGET_${String(providerId || "").toUpperCase()}`);
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_DAILY_BUDGET;
}

function cachePermitted(providerId, cachePolicy) {
  const id = String(providerId || "").toLowerCase();
  if (id.includes("google")) return false;
  if (cachePolicy === "never") return false;
  return true;
}

function userAgent(source) {
  return envString(source, "SPATIAL_USER_AGENT") || DEFAULT_USER_AGENT;
}

function statusOf(response) {
  if (response && typeof response.status === "number") return response.status;
  if (response && response.ok === false) return 500;
  return 200;
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function withUserAgent(init, agent) {
  const headers = Object.assign({}, init && init.headers);
  headers["User-Agent"] = agent;
  return Object.assign({}, init, { headers });
}

/**
 * Cache, single-flight, 429/406 backoff, and daily budget.
 * Caller must already know the provider env URL is set. Uncleared providers
 * return unconfigured before any of this runs.
 */
async function withProviderSafeguards(options, run) {
  if (!options || options.cleared !== true) return { outcome: "unconfigured" };
  const providerId = options.providerId;
  const cacheKey = options.cacheKey;
  const box = options.state || defaultSafeguardState;
  const clock = typeof options.now === "function" ? options.now : () => Date.now();
  const source = options.envSource || {};
  const ttl = resolveTtl(source, options.ttlMs);

  const readCache = (allowStale) => {
    if (!cacheKey) return null;
    const hit = box.cache.get(cacheKey);
    if (!hit) return null;
    if (!allowStale && clock() - hit.storedAt >= ttl) return null;
    return cloneJson(hit.value);
  };

  if (readCache(false)) return { outcome: "hit", value: readCache(false) };

  const exec = async () => {
    const again = readCache(false);
    if (again) return { outcome: "hit", value: again };
    const t = clock();
    if ((box.backoffUntil.get(providerId) || 0) > t) return { outcome: "backoff" };
    const limit = resolveBudget(source, providerId, options.budgetLimit);
    if (limit != null) {
      const key = `${providerId}|${new Date(t).toISOString().slice(0, 10)}`;
      const used = box.budget.get(key) || 0;
      if (used >= limit) return { outcome: "budget" };
      box.budget.set(key, used + 1);
    }
    const began = clock();
    const result = await run();
    const statusCode = result && typeof result.statusCode === "number" ? result.statusCode : 0;
    if (options.healthState && options.healthState.records instanceof Map) {
      const { recordProviderOutcome } = require("./providerHealth.cjs");
      recordProviderOutcome(options.healthState, providerId, {
        ok: statusCode === 0 || (statusCode >= 200 && statusCode < 400),
        at: clock(),
        latencyMs: clock() - began,
        statusCode,
        backoffUntil: BACKOFF_STATUSES.has(statusCode) ? clock() + PROVIDER_BACKOFF_MS : null,
      });
    }
    const permitted = cachePermitted(providerId, options.cachePolicy);
    if (BACKOFF_STATUSES.has(statusCode)) {
      box.backoffUntil.set(providerId, clock() + PROVIDER_BACKOFF_MS);
      const stale = readCache(true);
      if (stale) return { outcome: "stale", value: stale };
      return { outcome: "backoff", value: result.value };
    }
    if (result && result.cacheable && cacheKey && permitted) {
      box.cache.set(cacheKey, { storedAt: clock(), value: cloneJson(result.value) });
    }
    if (!(result && result.cacheable)) {
      const stale = readCache(true);
      if (stale) return { outcome: "stale", value: stale };
    }
    return { outcome: "miss", value: result ? result.value : null };
  };

  const prev = box.tails.get(providerId) || Promise.resolve();
  const current = prev.then(exec, exec);
  box.tails.set(providerId, current.then(() => undefined, () => undefined));
  return current;
}

module.exports = {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_DAILY_BUDGET,
  PROVIDER_BACKOFF_MS,
  DEFAULT_USER_AGENT,
  cachePermitted,
  createSafeguardState,
  envObject,
  envString,
  userAgent,
  statusOf,
  withUserAgent,
  withProviderSafeguards,
};
