const DOCUMENT = require("../data/providers.json");

const USER_URL_KEYS = [
  "url",
  "providerUrl",
  "userUrl",
  "interpreterUrl",
  "tileUrl",
  "baseUrl",
  "endpoint",
];

function dataSources(registry) {
  const rows = Array.isArray(registry) ? registry : DOCUMENT.providers;
  return rows.map((row) => Object.assign({}, row));
}

function providerGate(id, registry) {
  const rows = Array.isArray(registry) ? registry : DOCUMENT.providers;
  const row = rows.find((item) => item && item.id === id) || null;
  if (!row) return { id, status: "absent", cleared: false };
  return { id: row.id, status: row.status, cleared: row.status === "cleared" };
}

/**
 * spatial-lab overpass.js refuses a caller-supplied interpreter URL.
 * Operator configuration stays in env / the server `config` object.
 */
function refuseUserSuppliedProviderUrl(input) {
  if (!input || typeof input !== "object") return;
  for (const key of USER_URL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (value == null || value === "") continue;
    throw new Error("refusing user-supplied provider URL");
  }
}

function assertSameProviderUrl(envUrl, configUrl) {
  if (!envUrl || configUrl == null || configUrl === "") return;
  if (String(envUrl) !== String(configUrl)) {
    throw new Error("refusing user-supplied provider URL");
  }
}

const COMMERCIAL_CLASSES = Object.freeze([
  "APPROVED_COMMERCIAL",
  "APPROVED_WITH_ATTRIBUTION",
  "DEVELOPMENT_ONLY",
  "NON_COMMERCIAL",
  "UNKNOWN",
]);

const BLOCKED_IN_PRODUCTION = new Set(["UNKNOWN", "NON_COMMERCIAL", "DEVELOPMENT_ONLY"]);

const PROVIDER_CATEGORIES = Object.freeze([
  "maps",
  "terrain",
  "geocoding",
  "places",
  "routing",
  "traffic",
  "transit",
  "weather",
  "environment",
  "street_level",
  "imagery",
  "infrastructure",
  "future_realtime",
]);

const DAY_MS = 24 * 60 * 60 * 1000;

function meta(partial) {
  return Object.assign({
    capabilities: [],
    authentication: { required: false },
    attribution: null,
    rateLimits: { perMinuteDefault: 30 },
    cachePolicy: "ttl",
    freshnessPolicy: { staleAfterMs: DAY_MS },
    health: "unknown",
    fallbackPriority: 100,
  }, partial);
}

/** Wraps the Spatial Lab gate. OSRM is absent there, so it stays absent here. */
const PROVIDER_METADATA = {
  overpass: meta({
    category: "places",
    capabilities: ["amenities"],
    commercialUse: "APPROVED_WITH_ATTRIBUTION",
    attribution: "© OpenStreetMap contributors",
    freshnessPolicy: { staleAfterMs: 7 * DAY_MS },
    fallbackPriority: 10,
  }),
  tiles: meta({
    category: "maps",
    capabilities: ["tiles"],
    commercialUse: "UNKNOWN",
    cachePolicy: "never",
    fallbackPriority: 10,
  }),
  geocoder: meta({
    category: "geocoding",
    capabilities: ["geocode"],
    commercialUse: "UNKNOWN",
    fallbackPriority: 10,
  }),
  imagery: meta({
    category: "imagery",
    capabilities: ["imagery"],
    commercialUse: "NON_COMMERCIAL",
    cachePolicy: "never",
    fallbackPriority: 50,
  }),
  weather: meta({
    category: "weather",
    capabilities: ["weather"],
    commercialUse: "NON_COMMERCIAL",
    fallbackPriority: 40,
  }),
  traffic: meta({
    category: "traffic",
    capabilities: ["traffic"],
    commercialUse: "UNKNOWN",
    fallbackPriority: 40,
  }),
  osrm: meta({
    category: "routing",
    capabilities: ["route"],
    commercialUse: "NON_COMMERCIAL",
    attribution: "OSRM / ODbL; public FOSSGIS routing is not a commercial clearance",
    fallbackPriority: 20,
  }),
};

function decorateProvider(row) {
  const base = PROVIDER_METADATA[row.id] || meta({
    category: "future_realtime",
    commercialUse: "UNKNOWN",
  });
  const commercialUse = COMMERCIAL_CLASSES.includes(row.commercialUse)
    ? row.commercialUse
    : base.commercialUse || "UNKNOWN";
  return Object.assign({}, base, row, {
    commercialUse: COMMERCIAL_CLASSES.includes(commercialUse) ? commercialUse : "UNKNOWN",
    category: PROVIDER_CATEGORIES.includes(row.category) ? row.category : base.category,
    authentication: row.authentication || base.authentication,
    health: row.health || base.health,
  });
}

function providerRegistry(override) {
  const lab = dataSources(override);
  const rows = lab.map((row) => decorateProvider(row));
  if (!rows.some((row) => row.id === "osrm")) {
    rows.push(decorateProvider({ id: "osrm", status: "absent", env: "OSRM_BASE_URL" }));
  }
  return rows;
}

function isProductionRuntime(env, production) {
  if (production === true) return true;
  if (production === false) return false;
  const source = env || process.env;
  return source.NODE_ENV === "production" || source.SPATIAL_RUNTIME === "production";
}

function providerCanRun(id, options = {}) {
  const rows = providerRegistry(options.registry);
  const row = rows.find((item) => item.id === id) || null;
  if (!row) return { ok: false, code: "unconfigured", row: null };
  const gate = providerGate(id, options.registry);
  if (!gate.cleared && row.status !== "cleared") return { ok: false, code: "unconfigured", row };
  if (row.health === "down") return { ok: false, code: "unavailable", row };
  if (isProductionRuntime(options.env, options.production) && BLOCKED_IN_PRODUCTION.has(row.commercialUse)) {
    return { ok: false, code: "commercial_class_blocked", row };
  }
  const auth = row.authentication || {};
  if (auth.required) {
    const source = options.env || process.env;
    const secret = source ? source[auth.env] : "";
    if (typeof secret !== "string" || !secret.trim()) return { ok: false, code: "missing_api_key", row };
  }
  return { ok: true, code: "ok", row };
}

function providerFallback(category, options = {}) {
  return providerRegistry(options.registry)
    .filter((row) => row.category === category)
    .sort((a, b) => (a.fallbackPriority || 100) - (b.fallbackPriority || 100))
    .map((row) => providerCanRun(row.id, options))
    .filter((decision) => decision.ok)
    .map((decision) => decision.row);
}

module.exports = {
  DATA_SOURCE_REVISION: DOCUMENT.sourceRevision,
  COMMERCIAL_CLASSES,
  PROVIDER_CATEGORIES,
  dataSources,
  providerGate,
  refuseUserSuppliedProviderUrl,
  assertSameProviderUrl,
  providerRegistry,
  providerCanRun,
  providerFallback,
};
