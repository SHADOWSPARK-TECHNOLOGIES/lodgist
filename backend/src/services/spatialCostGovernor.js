/**
 * Backend wiring for the spatial-core persisted cost governor (Phase 12L).
 *
 * Every spatial tool that can reach a network provider (spatial.nearby,
 * spatial.route) is routed through spatial.governProviderCall before the tool
 * runs. Usage lives in the Prisma SpatialCostLedger table; when that table (or
 * its Prisma delegate) is not there yet, e.g. before migration
 * 20261010200000_spatial_cost_ledger is applied, the ledger degrades to the
 * spatial-core in-memory ledger instead of failing the request.
 *
 * Decisions: ALLOW and THROTTLE run the provider (THROTTLE optionally waits),
 * FALLBACK moves to the next provider in the chain, DENY stops the call.
 * No provider is activated here: the chain only contains providers whose env
 * URL is already configured.
 */
const spatial = require("../../../packages/spatial-core");
const { fetchAllowlisted } = require("../../../packages/spatial-core/src/proxy.cjs");
const { createPrismaCostLedger } = require("./spatialCostLedgerStore");

const PROVIDER_ENV = {
  "overpass-selfhosted": ["OVERPASS_SELFHOSTED_URL"],
  "overpass-public": ["OVERPASS_INTERPRETER_URL"],
  osrm: ["OSRM_BASE_URL"],
};
const ALL_PROVIDER_ENV = [...new Set(Object.values(PROVIDER_ENV).flat())];

// Prisma "table does not exist" / "column does not exist" style errors.
const MISSING_TABLE_CODES = new Set(["P2021", "P2022", "42P01"]);

function isMissingTableError(error) {
  if (!error) return false;
  if (MISSING_TABLE_CODES.has(error.code)) return true;
  if (error.meta && MISSING_TABLE_CODES.has(error.meta.code)) return true;
  return /SpatialCostLedger.*(does not exist|not exist)|relation .*SpatialCostLedger/i.test(String(error.message || ""));
}

/**
 * Ledger with the governProviderCall read/add interface. Uses Prisma when the
 * table exists, otherwise (no prisma, no delegate, missing table) falls back
 * to the in-memory ledger for the life of the process.
 */
function createResilientCostLedger(prisma, options = {}) {
  const memory = spatial.createMemoryCostLedger();
  const hasDelegate = Boolean(prisma && prisma.spatialCostLedger
    && typeof prisma.spatialCostLedger.findUnique === "function"
    && typeof prisma.spatialCostLedger.upsert === "function");
  const durable = hasDelegate ? createPrismaCostLedger(prisma) : null;
  const log = typeof options.log === "function" ? options.log : null;
  const state = { mode: durable ? "prisma" : "memory", reason: durable ? null : "no_prisma_delegate" };

  function degrade(error) {
    state.mode = "memory";
    state.reason = isMissingTableError(error) ? "table_missing" : "store_error";
    if (log) log({ event: "spatial_cost_ledger_degraded", reason: state.reason });
  }

  async function run(op, scope, delta) {
    if (state.mode === "prisma") {
      try {
        return await durable[op](scope, delta);
      } catch (error) {
        degrade(error);
      }
    }
    return memory[op](scope, delta);
  }

  return {
    read: (scope) => run("read", scope),
    add: (scope, delta) => run("add", scope, delta),
    get mode() { return state.mode; },
    get reason() { return state.reason; },
    memory,
  };
}

function envString(env, key) {
  return env && typeof env[key] === "string" ? env[key].trim() : "";
}

/** Configured providers (env URL present) with their base URL, in preference order. */
function configuredProviders(env) {
  const out = [];
  const self = envString(env, "OVERPASS_SELFHOSTED_URL");
  // Core refuses OVERPASS_SELFHOSTED_URL and OVERPASS_INTERPRETER_URL together, so a
  // governor fallback target for the self-hosted interpreter is named separately.
  const pub = envString(env, "OVERPASS_INTERPRETER_URL") || envString(env, "OVERPASS_FALLBACK_URL");
  const osrm = envString(env, "OSRM_BASE_URL").replace(/\/$/, "");
  if (self) out.push({ id: "overpass-selfhosted", base: self, fallback: pub ? "overpass-public" : null });
  if (pub) out.push({ id: "overpass-public", base: pub, fallback: null });
  if (osrm) out.push({ id: "osrm", base: osrm, fallback: null });
  return out;
}

function sameOrigin(a, b) {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.protocol === y.protocol && x.host.toLowerCase() === y.host.toLowerCase();
  } catch {
    return false;
  }
}

/** Which configured provider a core fetch targets (longest matching base wins). */
function providerForUrl(url, env) {
  const href = String(url || "");
  const rows = configuredProviders(env)
    .filter((row) => href.startsWith(row.base) || sameOrigin(href, row.base))
    .sort((a, b) => b.base.length - a.base.length);
  return rows[0] || null;
}

function numberEnv(env, key) {
  const raw = envString(env, key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function envKey(providerId) {
  return providerId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/** Budget: explicit options win, then SPATIAL_COST_<ID>_MAX_REQUESTS / _MAX_COST. */
function budgetFor(providerId, env, budgets) {
  if (budgets && budgets[providerId]) return budgets[providerId];
  const maxRequests = numberEnv(env, `SPATIAL_COST_${envKey(providerId)}_MAX_REQUESTS`);
  const maxCost = numberEnv(env, `SPATIAL_COST_${envKey(providerId)}_MAX_COST`);
  if (maxRequests === undefined && maxCost === undefined) return undefined;
  return { maxRequests, maxCost };
}

function deniedError(providerId) {
  const error = new Error("spatial provider call denied by cost governor");
  error.code = "budget_denied";
  error.provider = providerId;
  return error;
}

/**
 * Wrap the fetch spatial-core uses for provider calls. Every outbound call is
 * metered through spatial.governProviderCall against `ledger`:
 *   ALLOW    -> call the provider
 *   THROTTLE -> optional delay, then call the provider
 *   FALLBACK -> govern and call the next configured provider instead (only when
 *               that provider is itself allowed to run by core policy)
 *   DENY     -> no network call; throws (core reports provider_unavailable)
 * A call to a URL that matches no configured provider is denied.
 */
function createGovernedFetch(fetchImpl, options = {}) {
  const env = options.env || {};
  const ledger = options.ledger;
  const decisions = [];
  // Which provider actually answered each outbound call (requested vs served).
  const served = [];
  const canRun = (id) => {
    const verdict = spatial.providerCanRun(id, { registry: options.registry, env, production: options.production });
    return Boolean(verdict && verdict.ok);
  };

  async function governed(url, init, provider, switched) {
    const fallbackRow = provider.fallback && canRun(provider.fallback)
      ? configuredProviders(env).find((row) => row.id === provider.fallback) || null
      : null;
    const verdict = await spatial.governProviderCall(ledger, {
      provider: provider.id,
      tenant: options.tenant || "lodgist",
      agent: options.agent || "default",
      budget: budgetFor(provider.id, env, options.budgets),
      paid: Boolean(options.paid && options.paid[provider.id]),
      estimatedCost: options.estimatedCost && Number.isFinite(options.estimatedCost[provider.id]) ? options.estimatedCost[provider.id] : undefined,
      fallbackAvailable: Boolean(fallbackRow),
      now: typeof options.now === "function" ? options.now() : undefined,
    });
    decisions.push({ provider: provider.id, decision: verdict.decision, reason: verdict.reason });
    if (verdict.decision === "DENY") throw deniedError(provider.id);
    if (verdict.decision === "FALLBACK") {
      const href = String(url);
      const nextUrl = href.startsWith(provider.base) ? fallbackRow.base + href.slice(provider.base.length) : fallbackRow.base;
      return governed(nextUrl, init, fallbackRow, switched || provider.id);
    }
    if (verdict.decision === "THROTTLE" && options.throttleDelayMs > 0) {
      await new Promise((r) => setTimeout(r, options.throttleDelayMs));
    }
    if (!switched) {
      served.push({ requested: provider.id, servedBy: provider.id, fallback: false });
      return fetchImpl(url, init);
    }
    served.push({ requested: switched, servedBy: provider.id, fallback: true });
    // Core only allowlisted the primary host; re-apply the same SSRF guard to the fallback.
    const guarded = await fetchAllowlisted({
      url,
      allowedHosts: [new URL(provider.base).hostname],
      fetchImpl,
      lookup: options.lookup,
      timeoutMs: options.timeoutMs,
      init: Object.assign({}, init, { signal: undefined }),
    });
    const payload = await guarded.json();
    return new Response(payload == null ? "" : JSON.stringify(payload), {
      status: guarded.status && guarded.status >= 200 && guarded.status <= 599 ? guarded.status : 502,
      headers: { "Content-Type": "application/json", "X-Spatial-Provider": provider.id },
    });
  }

  const wrapped = async (url, init) => {
    const provider = providerForUrl(url, env);
    if (!provider) {
      decisions.push({ provider: "unknown", decision: "DENY", reason: "unrecognised provider host" });
      throw deniedError("unknown");
    }
    return governed(url, init, provider);
  };
  wrapped.decisions = decisions;
  wrapped.served = served;
  return wrapped;
}

function providerRow(id, registry) {
  try {
    return spatial.providerRegistry(registry).find((row) => row.id === id) || null;
  } catch {
    return null;
  }
}

/**
 * Rewrite a tool result so its evidence names the provider that actually
 * served the data (not the one core asked for). On FALLBACK the primary
 * provider can never appear as the source: provider, commercial class and
 * attribution come from the fallback row, and a warning says so.
 */
function attributeServedProvider(result, served, options = {}) {
  if (!result || typeof result !== "object" || !Array.isArray(served) || served.length === 0) return result;
  const last = served[served.length - 1];
  const row = providerRow(last.servedBy, options.registry);
  const commercialUse = row && row.commercialUse ? row.commercialUse : "UNKNOWN";
  const attribution = row && typeof row.attribution === "string" ? row.attribution : null;
  const servedBy = {
    provider: last.servedBy,
    requestedProvider: last.requested,
    fallback: last.fallback === true,
    commercialUse,
    attribution,
  };
  const out = Object.assign({}, result, { servedBy });
  if (result.provenance && typeof result.provenance === "object") {
    out.provenance = Object.assign({}, result.provenance, {
      provider: last.servedBy,
      attribution: attribution || result.provenance.attribution || null,
      commercialUse,
      fallbackFrom: servedBy.fallback ? last.requested : null,
    });
  }
  if (result.dataQuality && typeof result.dataQuality === "object") {
    out.dataQuality = Object.assign({}, result.dataQuality, { servedBy: last.servedBy, commercialUse, attribution });
  }
  if (servedBy.fallback) {
    const warning = `Provider fallback used: ${last.requested} was not called; data served by ${last.servedBy} (${commercialUse}).`;
    out.warnings = [...(Array.isArray(result.warnings) ? result.warnings : []), warning];
    // Core computed dataQuality before the fallback was known; surface it there too.
    if (out.dataQuality) {
      const dq = out.dataQuality;
      out.dataQuality = Object.assign({}, dq, {
        warnings: [...(Array.isArray(dq.warnings) ? dq.warnings : []), warning],
        ruleIds: [...(Array.isArray(dq.ruleIds) ? dq.ruleIds : []), "dq.provider.fallback"],
      });
    }
  }
  return out;
}

/**
 * Record cache hits in the ledger: zero cost, no provider request, under the
 * provider spatial-core reports in meta.cache.servedBy (the one that fetched it).
 */
async function recordCacheHits(ledger, reads, options = {}) {
  const out = [];
  for (const provider of reads) {
    out.push(await spatial.governProviderCall(ledger, {
      provider,
      tenant: options.tenant || "lodgist",
      agent: options.agent || "default",
      cacheHit: true,
      now: typeof options.now === "function" ? options.now() : undefined,
    }));
  }
  return out;
}

module.exports = {
  createResilientCostLedger,
  createGovernedFetch,
  providerForUrl,
  isMissingTableError,
  attributeServedProvider,
  recordCacheHits,
};
