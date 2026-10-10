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

const TERMS_CHECKED_AT = "2026-10-10";

function meta(partial) {
  return Object.assign({
    capabilities: [],
    authentication: { required: false },
    attribution: null,
    license: null,
    termsUrl: null,
    termsCheckedAt: null,
    rateLimits: { perMinuteDefault: 30 },
    cachePolicy: "ttl",
    freshnessPolicy: { staleAfterMs: DAY_MS },
    health: "unknown",
    fallbackPriority: 100,
  }, partial);
}

/**
 * Wraps the Spatial Lab gate. OSRM is absent there, so it stays absent here.
 * `overpass` is not a shipped row. It remains so an override registry that
 * still names that id keeps the previous amenity gate.
 */
const PROVIDER_METADATA = {
  overpass: meta({
    category: "places",
    capabilities: ["amenities"],
    commercialUse: "APPROVED_WITH_ATTRIBUTION",
    attribution: "© OpenStreetMap contributors",
    license: "ODbL-1.0",
    termsUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    termsCheckedAt: TERMS_CHECKED_AT,
    freshnessPolicy: { staleAfterMs: 7 * DAY_MS },
    fallbackPriority: 10,
  }),
  "overpass-public": meta({
    category: "places",
    capabilities: ["amenities"],
    commercialUse: "DEVELOPMENT_ONLY",
    attribution: "© OpenStreetMap contributors",
    license: "ODbL-1.0",
    termsUrl: "https://dev.overpass-api.de/overpass-doc/en/preface/commons.html",
    termsCheckedAt: TERMS_CHECKED_AT,
    freshnessPolicy: { staleAfterMs: 7 * DAY_MS },
    fallbackPriority: 20,
  }),
  "overpass-selfhosted": meta({
    category: "places",
    capabilities: ["amenities"],
    commercialUse: "APPROVED_WITH_ATTRIBUTION",
    attribution: "© OpenStreetMap contributors",
    license: "ODbL-1.0",
    termsUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    termsCheckedAt: TERMS_CHECKED_AT,
    freshnessPolicy: { staleAfterMs: 7 * DAY_MS },
    fallbackPriority: 10,
  }),
  tiles: meta({
    category: "maps",
    capabilities: ["tiles"],
    commercialUse: "UNKNOWN",
    cachePolicy: "never",
    termsCheckedAt: TERMS_CHECKED_AT,
    fallbackPriority: 10,
  }),
  geocoder: meta({
    category: "geocoding",
    capabilities: ["geocode"],
    commercialUse: "UNKNOWN",
    termsCheckedAt: TERMS_CHECKED_AT,
    fallbackPriority: 10,
  }),
  imagery: meta({
    category: "imagery",
    capabilities: ["imagery"],
    commercialUse: "NON_COMMERCIAL",
    cachePolicy: "never",
    termsCheckedAt: TERMS_CHECKED_AT,
    fallbackPriority: 50,
  }),
  weather: meta({
    category: "weather",
    capabilities: ["weather"],
    commercialUse: "NON_COMMERCIAL",
    termsUrl: "https://open-meteo.com/en/license",
    termsCheckedAt: TERMS_CHECKED_AT,
    fallbackPriority: 40,
  }),
  traffic: meta({
    category: "traffic",
    capabilities: ["traffic"],
    commercialUse: "UNKNOWN",
    termsCheckedAt: TERMS_CHECKED_AT,
    fallbackPriority: 40,
  }),
  "google-photorealistic-3d": meta({
    category: "maps",
    capabilities: ["3d-tiles"],
    commercialUse: "UNKNOWN",
    cachePolicy: "never",
    authentication: { required: true, env: "GOOGLE_MAPS_3D_KEY" },
    termsUrl: "https://cloud.google.com/maps-platform/terms",
    termsCheckedAt: TERMS_CHECKED_AT,
    fallbackPriority: 90,
  }),
  mapillary: meta({
    category: "street_level",
    capabilities: ["street-imagery"],
    commercialUse: "UNKNOWN",
    license: "CC-BY-SA-4.0",
    cachePolicy: "never",
    authentication: { required: true, env: "MAPILLARY_TOKEN" },
    termsUrl: "https://www.mapillary.com/terms",
    termsCheckedAt: TERMS_CHECKED_AT,
    fallbackPriority: 90,
  }),
  osrm: meta({
    category: "routing",
    capabilities: ["route"],
    commercialUse: "NON_COMMERCIAL",
    attribution: "OSRM / ODbL; public FOSSGIS routing is not a commercial clearance",
    license: "ODbL-1.0",
    termsUrl: "https://www.openstreetmap.org/copyright",
    termsCheckedAt: TERMS_CHECKED_AT,
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
  const termsUrl = row.termsUrl !== undefined ? row.termsUrl : base.termsUrl;
  const termsCheckedAt = row.termsCheckedAt !== undefined ? row.termsCheckedAt : base.termsCheckedAt;
  const license = row.license !== undefined ? row.license : base.license;
  return Object.assign({}, base, row, {
    commercialUse: COMMERCIAL_CLASSES.includes(commercialUse) ? commercialUse : "UNKNOWN",
    category: PROVIDER_CATEGORIES.includes(row.category) ? row.category : base.category,
    authentication: row.authentication || base.authentication,
    health: row.health || base.health,
    termsUrl: typeof termsUrl === "string" && termsUrl.trim() ? termsUrl : null,
    termsCheckedAt: typeof termsCheckedAt === "string" && termsCheckedAt.trim() ? termsCheckedAt : null,
    license: typeof license === "string" && license.trim() ? license : null,
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
  if (policyBlocks(id, options)) return { ok: false, code: "policy_blocked", row };
  const auth = row.authentication || {};
  if (auth.required) {
    const source = options.env || process.env;
    const secret = source ? source[auth.env] : "";
    if (typeof secret !== "string" || !secret.trim()) return { ok: false, code: "missing_api_key", row };
  }
  return { ok: true, code: "ok", row };
}

/**
 * Phase 12N provider policy. A provider is enabled only when it is
 * configured AND commercially approved AND its feature flag is on.
 * Policy overrides can only remove access, never grant it.
 */
const PROVIDER_POLICY = Object.freeze({
  "overpass-public": { policy: "DEVELOPMENT_ONLY", reason: "Public Overpass is development-only; never production." },
  osrm: { policy: "NOT_PRODUCTION_APPROVED", reason: "Public OSRM demo is not approved for production." },
  "google-photorealistic-3d": { policy: "DISABLED", reason: "Google 3D tiles are disabled (licence, key exposure, caching ban)." },
  mapillary: { policy: "DEFERRED", reason: "Mapillary street-level imagery is deferred (CC BY-SA, NDPA privacy)." },
});
const APPROVED_CLASSES = new Set(["APPROVED_COMMERCIAL", "APPROVED_WITH_ATTRIBUTION"]);

function featureFlagName(id) {
  return `SPATIAL_PROVIDER_${String(id || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_ENABLED`;
}

function flagOn(source, name) {
  const raw = source && typeof source[name] === "string" ? source[name].trim().toLowerCase() : "";
  return ["1", "true", "on", "yes"].includes(raw);
}

function providerPolicy(id, options = {}) {
  const source = options.env || process.env;
  const production = isProductionRuntime(options.env, options.production);
  const row = providerRegistry(options.registry).find((item) => item.id === id) || null;
  const policy = PROVIDER_POLICY[id] || { policy: "STANDARD", reason: null };
  const envName = row && row.env;
  const envSet = !envName || (typeof source[envName] === "string" && source[envName].trim() !== "");
  const configured = Boolean(row && row.status === "cleared" && envSet);
  let commerciallyApproved = Boolean(row && APPROVED_CLASSES.has(row.commercialUse));
  if (policy.policy === "DISABLED" || policy.policy === "DEFERRED") commerciallyApproved = false;
  if (production && (policy.policy === "DEVELOPMENT_ONLY" || policy.policy === "NOT_PRODUCTION_APPROVED")) {
    commerciallyApproved = false;
  }
  if (!production && policy.policy === "DEVELOPMENT_ONLY" && row) commerciallyApproved = true;
  const featureEnabled = policy.policy === "DISABLED" || policy.policy === "DEFERRED"
    ? false
    : flagOn(source, featureFlagName(id));
  return {
    id,
    policy: policy.policy,
    reason: policy.reason,
    configured,
    commerciallyApproved,
    featureEnabled,
    flag: featureFlagName(id),
    enabled: configured && commerciallyApproved && featureEnabled,
  };
}

function policyBlocks(id, options) {
  const policy = PROVIDER_POLICY[id];
  if (!policy) return false;
  if (policy.policy === "DISABLED" || policy.policy === "DEFERRED") return true;
  return isProductionRuntime(options.env, options.production)
    && (policy.policy === "DEVELOPMENT_ONLY" || policy.policy === "NOT_PRODUCTION_APPROVED");
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
  TERMS_CHECKED_AT,
  COMMERCIAL_CLASSES,
  PROVIDER_CATEGORIES,
  dataSources,
  providerGate,
  refuseUserSuppliedProviderUrl,
  assertSameProviderUrl,
  providerRegistry,
  providerCanRun,
  providerFallback,
  PROVIDER_POLICY,
  featureFlagName,
  providerPolicy,
  isProductionRuntime,
};
