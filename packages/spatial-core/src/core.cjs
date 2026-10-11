const { CAMPUSES, campusById } = require("./campuses.cjs");
const { ALLOWED_LAYERS, BANNED_LAYERS, assertLayerId } = require("./catalog.cjs");
const {
  DATA_SOURCE_REVISION,
  dataSources,
  providerGate,
  refuseUserSuppliedProviderUrl,
  assertSameProviderUrl,
  providerCanRun,
  providerRegistry,
  providerFallback,
  COMMERCIAL_CLASSES,
  PROVIDER_CATEGORIES,
} = require("./registry.cjs");
const {
  PRIVATE_LOCATION_KEYS,
  assertNoPrivateLocationKeys,
  stripPrivateLocationKeys,
} = require("./privacy.cjs");
const {
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
} = require("./safeguards.cjs");
const { fetchAllowlisted } = require("./proxy.cjs");
const { LEGACY_AMENITY_QUERY, buildAmenityQuery } = require("./overpassQuery.cjs");

let isPublicListing = function failClosed() {
  return false;
};

function configureSpatialCore(options) {
  if (options && typeof options.isPublicListing === "function") {
    isPublicListing = options.isPublicListing;
  }
}

const DISCLAIMER =
  "A map does not show who owns this home, what condition it is in, whether it is available, or whether the area is safe.";

const ROUTING_UNAVAILABLE = "Routing unavailable";

const AMENITY_CATEGORIES = ["shop", "pharmacy", "clinic", "transport"];

const CATEGORY_LABEL = {
  shop: "Shops",
  pharmacy: "Pharmacies",
  clinic: "Clinics",
  transport: "Transport",
};

/** Area near Nekede used only by the labelled preview. Not a surveyed building. */
const FIXTURE_AREA = {
  lat: 5.4214,
  lng: 7.0419,
  radiusM: 800,
  label: "Near Nekede, Owerri West",
};

/** Pin used only when the preview is switched to the exact-fixture state. */
const FIXTURE_PIN = {
  lat: 5.4221,
  lng: 7.0426,
  label: "DEV fixture pin near Nekede",
};

const FIXTURE_AMENITIES = [
  {
    id: "dev-shop",
    name: "DEV fixture shop",
    category: "shop",
    lat: 5.4222,
    lng: 7.0408,
    provenance: "DEV fixture. Not a real business.",
    fixture: true,
  },
  {
    id: "dev-pharmacy",
    name: "DEV fixture pharmacy",
    category: "pharmacy",
    lat: 5.4206,
    lng: 7.0431,
    provenance: "DEV fixture. Not a real business.",
    fixture: true,
  },
  {
    id: "dev-clinic",
    name: "DEV fixture clinic",
    category: "clinic",
    lat: 5.423,
    lng: 7.0422,
    provenance: "DEV fixture. Not a real business.",
    fixture: true,
  },
  {
    id: "dev-transport",
    name: "DEV fixture bus stop",
    category: "transport",
    lat: 5.421,
    lng: 7.0399,
    provenance: "DEV fixture. Not a real business.",
    fixture: true,
  },
];

function parseCoordinate(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function isFixtureRecord(record) {
  if (!record || typeof record !== "object") return false;
  return record.fixture === true || record.devFixture === true || record.inventory === "excluded";
}

function areaLabel(listing) {
  const property = listing && listing.property;
  if (!property || typeof property !== "object") return null;
  const parts = [property.lga, property.city, property.state].filter((part) => typeof part === "string" && part.trim());
  return parts.length ? parts.join(", ") : null;
}

function validRadius(radius) {
  return typeof radius === "number" && Number.isFinite(radius) && radius > 0 && radius <= 20000;
}

/**
 * Public location policy. An exact pin is permitted only for an explicit
 * fixture pin. A snapped area center, a named area, or a private coordinate
 * is never promoted to an exact building location.
 */
function exactPinPermitted(focus, allowExactOrigin) {
  return Boolean(
    focus
    && focus.precision === "exact"
    && focus.fixturePin === true
    && allowExactOrigin === true
    && parseCoordinate(focus.lat, focus.lng),
  );
}

/**
 * EXACT is not produced here. APPROXIMATE requires an explicit public point
 * and radius. AREA_ONLY keeps a known place name and no coordinate.
 * UNKNOWN invents neither a name nor a coordinate.
 */
function focusFromPublicListing(listing) {
  const label = areaLabel(listing);
  const approx = listing && listing.approxLocation;
  if (approx && typeof approx === "object") {
    const point = parseCoordinate(approx.lat, approx.lng);
    if (point && validRadius(approx.radius_m)) {
      return {
        precision: "approximate",
        label: label || "Published area",
        lat: point.lat,
        lng: point.lng,
        radiusM: approx.radius_m,
      };
    }
  }
  if (label) return { precision: "area-only", label };
  return { precision: "unknown", label: "Location not published" };
}

function spatialPublicationDecision(listing) {
  if (!listing || typeof listing !== "object") return { published: false, reason: "missing" };
  if (isFixtureRecord(listing)) return { published: false, reason: "fixture" };
  if (!isPublicListing(listing)) return { published: false, reason: "unpublished" };
  return { published: true, reason: "public" };
}

function buildPublicSpatialContext(listing) {
  const decision = spatialPublicationDecision(listing);
  if (!decision.published) return null;
  const focus = focusFromPublicListing(listing);
  const context = {
    fixture: false,
    inventory: "public",
    listingId: listing.id,
    title: typeof listing.title === "string" ? listing.title : "Home",
    focus,
    disclaimer: DISCLAIMER,
    evidenceVerified: false,
    reviewForDisplay: listing.reviewStatus === "APPROVED",
    allowExactOrigin: false,
    locationState: focus.precision,
  };
  return assertNoPrivateLocationKeys(context);
}

/**
 * Shared boundary for Rent, Buy, and Land. Purpose is accepted only when the
 * caller supplies it. Category is not treated as a transaction purpose, and
 * authorizedLocation is never copied into the public result.
 */
function adaptSpatialListing(input) {
  const source = input && typeof input === "object" ? input : null;
  const listing = source && source.listing && typeof source.listing === "object" ? source.listing : source;
  if (!spatialPublicationDecision(listing).published) return null;
  const focus = focusFromPublicListing(listing);
  const purpose = source && typeof source.purpose === "string" && source.purpose.trim()
    ? source.purpose.trim()
    : "unspecified";
  return assertNoPrivateLocationKeys({
    id: listing.id,
    purpose,
    category: typeof listing.category === "string" ? listing.category : null,
    publicationStatus: "public",
    locationState: focus.precision,
    publicLocation: focus,
  });
}

function anonymousListingRequest(apiBase, id) {
  const base = String(apiBase || "").replace(/\/$/, "");
  return {
    url: `${base}/api/listings/${id}`,
    init: { cache: "no-store", headers: { Accept: "application/json" } },
  };
}

function straightLineMeters(a, b) {
  const from = a && parseCoordinate(a.lat, a.lng);
  const to = b && parseCoordinate(b.lat, b.lng);
  if (!from || !to) return null;
  const earth = 6371000;
  const p1 = (from.lat * Math.PI) / 180;
  const p2 = (to.lat * Math.PI) / 180;
  const dp = ((to.lat - from.lat) * Math.PI) / 180;
  const dl = ((to.lng - from.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

function straightLineLabel(meters) {
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) return null;
  const distance = meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  return `${distance} straight-line`;
}

function focusPoint(focus) {
  if (!focus || (focus.precision !== "approximate" && focus.precision !== "exact")) return null;
  return parseCoordinate(focus.lat, focus.lng);
}

/**
 * External directions. Approximate and unknown origins use a place name only.
 * Exact coordinates are included only for an explicit fixture pin.
 */
function externalDirectionsUrl(input) {
  const destination = input && input.destination;
  const dest = destination && parseCoordinate(destination.lat, destination.lng);
  if (!dest || !destination.name) return null;
  const destParam = `${dest.lat},${dest.lng}`;
  const exact = input.originExact && parseCoordinate(input.originExact.lat, input.originExact.lng);
  const allowExact = exactPinPermitted({
    precision: input.precision,
    fixturePin: input.fixturePin,
    lat: exact && exact.lat,
    lng: exact && exact.lng,
  }, input.allowExactOrigin);
  if (allowExact) {
    return `https://www.google.com/maps/dir/?api=1&origin=${exact.lat},${exact.lng}&destination=${encodeURIComponent(destParam)}&destination_place=${encodeURIComponent(destination.name)}`;
  }
  const label = typeof input.originLabel === "string" ? input.originLabel.trim() : "";
  const origin = label ? `&origin=${encodeURIComponent(label)}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(destination.name)}`;
}

function urlLeaksCoordinates(url, coords) {
  if (!url) return false;
  const text = decodeURIComponent(url);
  return coords.some((coord) => {
    const point = parseCoordinate(coord.lat, coord.lng);
    if (!point) return false;
    return text.includes(String(point.lat)) || text.includes(String(point.lng));
  });
}

function readProviderConfig(env) {
  const source = env || process.env;
  const read = (name) => (typeof source[name] === "string" ? source[name].trim() : "");
  return {
    osrmBaseUrl: read("OSRM_BASE_URL").replace(/\/$/, "") || null,
    overpassUrl: read("OVERPASS_INTERPRETER_URL") || null,
    tileUrl: read("NEXT_PUBLIC_MAP_TILE_URL") || null,
    attribution: read("NEXT_PUBLIC_MAP_ATTRIBUTION") || null,
  };
}

function publicSubject(value) {
  if (typeof value !== "string") return "home";
  const subject = value.trim().toLowerCase();
  return /^[a-z]{3,12}$/.test(subject) ? subject : "home";
}

function publicTileTemplate(env) {
  const config = readProviderConfig(env);
  if (!config.tileUrl || !config.attribution) return null;
  return config.tileUrl;
}

function describeRoute(result) {
  if (!result || result.status !== "ok") {
    const detail = {
      "needs-campus": "Select a campus. A road route is not shown yet.",
      unconfigured: "No routing provider is configured.",
      failed: "The routing provider did not return a route.",
      unavailable: result && result.origin === "area-only"
        ? "A named area is published, but there is no coordinate to route from."
        : "This home has no published location to route from.",
    }[result && result.status] || "No routing provider is configured.";
    return { primary: ROUTING_UNAVAILABLE, detail, distanceM: null, durationS: null };
  }
  const km = `${(result.distanceM / 1000).toFixed(1)} km by road`;
  const minutes = `${Math.round(result.durationS / 60)} min`;
  const origin = result.origin === "approximate"
    ? " The start is the published area, not a building."
    : " The start is the fixture pin, not a surveyed home.";
  return {
    primary: `${km}, ${minutes}, from the routing provider.${origin}`,
    detail: "This time comes from the routing provider.",
    distanceM: result.distanceM,
    durationS: result.durationS,
  };
}

function providerSignal() {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(8000)
    : undefined;
}

function routeMetrics(route) {
  if (!route || typeof route.distance !== "number" || typeof route.duration !== "number") return null;
  if (!Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return null;
  if (route.distance < 0 || route.duration < 0) return null;
  return { distanceM: route.distance, durationS: route.duration };
}

/** Registry row view used to stamp cache entries with the serving provider. */
function providerDescriber(registry) {
  return (id) => {
    let row = null;
    try {
      row = providerRegistry(registry).find((item) => item.id === id) || null;
    } catch {
      row = null;
    }
    return {
      provider: id,
      commercialUse: row && row.commercialUse ? row.commercialUse : "UNKNOWN",
      attribution: row && typeof row.attribution === "string" ? row.attribution : null,
    };
  };
}

/** A host-declared serving provider counts only when it is a registry row. */
function servedProviderId(response, requested, registry) {
  const id = response && typeof response.servedBy === "string" ? response.servedBy.trim() : "";
  if (!id || id === requested) return requested;
  try {
    return providerRegistry(registry).some((item) => item.id === id) ? id : requested;
  } catch {
    return requested;
  }
}

function traceCache(input, providerId, guarded) {
  if (Array.isArray(input.cacheTrace) && guarded && guarded.cache) {
    input.cacheTrace.push(Object.assign({ requested: providerId }, guarded.cache));
  }
}

function routePayload(focus, status, distanceM, durationS) {
  return assertNoPrivateLocationKeys({
    status,
    distanceM,
    durationS,
    origin: focus && focus.precision,
  });
}

async function loadRouteGuarded(input, focus, origin, envUrl, campus, fetchImpl, empty) {
  const dest = parseCoordinate(campus.lat, campus.lng);
  if (!dest) return empty("failed");
  const gate = providerGate("osrm", input.registry);
  const path = `/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
  const source = envObject(input);
  const decision = providerCanRun("osrm", { registry: input.registry, env: source, production: input.production });
  if (!decision.ok) return empty("unconfigured");
  const guarded = await withProviderSafeguards({
    providerId: "osrm",
    cacheKey: `osrm|${cellKey(focus)}|${campus.id}`,
    cleared: gate.cleared,
    state: input.safeguardState,
    now: input.now,
    ttlMs: input.ttlMs,
    budgetLimit: input.budgetLimit,
    cachePolicy: decision.row && decision.row.cachePolicy,
    envSource: source,
    describeProvider: providerDescriber(input.registry),
  }, async () => {
    try {
      const response = await fetchAllowlisted({
        url: `${envUrl}${path}`,
        allowedHosts: [new URL(envUrl).hostname],
        fetchImpl,
        lookup: input.lookup,
        timeoutMs: input.timeoutMs,
        maxBytes: input.maxBytes,
        init: withUserAgent({ cache: "no-store" }, userAgent(source)),
      });
      const statusCode = statusOf(response);
      if (!response || !response.ok) return { statusCode, cacheable: false, value: empty("failed") };
      const body = await response.json();
      if (body && body.code && body.code !== "Ok") return { statusCode, cacheable: false, value: empty("failed") };
      const route = body && Array.isArray(body.routes) ? body.routes[0] : null;
      const metrics = routeMetrics(route);
      if (!metrics) return { statusCode, cacheable: false, value: empty("failed") };
      return {
        statusCode,
        cacheable: true,
        servedBy: servedProviderId(response, "osrm", input.registry),
        value: routePayload(focus, "ok", metrics.distanceM, metrics.durationS),
      };
    } catch {
      return { statusCode: 0, cacheable: false, value: empty("failed") };
    }
  });
  traceCache(input, "osrm", guarded);
  if (guarded.outcome === "unconfigured" || guarded.outcome === "budget") return empty("unconfigured");
  return guarded.value || empty("failed");
}

async function loadRoute(input = {}) {
  refuseUserSuppliedProviderUrl(input);
  const { focus, campus, config, fetchImpl } = input;
  const empty = (status) => routePayload(focus, status, null, null);
  if (!campus) return empty("needs-campus");
  const origin = focusPoint(focus);
  if (!origin) return empty("unavailable");
  const envUrl = providerEnvUrl(input, "OSRM_BASE_URL", (value) => value.replace(/\/$/, ""));
  if (envUrl) {
    const configUrl = config && typeof config.osrmBaseUrl === "string" ? config.osrmBaseUrl.replace(/\/$/, "") : "";
    assertSameProviderUrl(envUrl, configUrl);
    return loadRouteGuarded(input, focus, origin, envUrl, campus, fetchImpl, empty);
  }
  const provider = config || readProviderConfig();
  if (!provider.osrmBaseUrl) return empty("unconfigured");
  const dest = parseCoordinate(campus.lat, campus.lng);
  if (!dest) return empty("failed");
  const path = `/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
  try {
    const response = await fetchImpl(`${provider.osrmBaseUrl}${path}`, { cache: "no-store", signal: providerSignal() });
    if (!response.ok) return empty("failed");
    const body = await response.json();
    if (body && body.code && body.code !== "Ok") return empty("failed");
    const route = body && Array.isArray(body.routes) ? body.routes[0] : null;
    const metrics = routeMetrics(route);
    if (!metrics) return empty("failed");
    return routePayload(focus, "ok", metrics.distanceM, metrics.durationS);
  } catch {
    return empty("failed");
  }
}

function categoryFromTags(tags) {
  if (!tags || typeof tags !== "object") return null;
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "clinic" || tags.amenity === "doctors" || tags.amenity === "hospital") return "clinic";
  if (tags.highway === "bus_stop" || tags.amenity === "bus_station" || tags.public_transport === "platform") return "transport";
  if (typeof tags.shop === "string" && tags.shop) return "shop";
  return null;
}

function unnamedAmenity(category) {
  if (category === "pharmacy") return "Pharmacy (name not provided by OpenStreetMap)";
  if (category === "clinic") return "Clinic (name not provided by OpenStreetMap)";
  if (category === "transport") return "Transport stop (name not provided by OpenStreetMap)";
  return "Shop (name not provided by OpenStreetMap)";
}

function parseOverpass(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.elements)) return null;
  const amenities = [];
  for (const element of body.elements) {
    if (amenities.length >= 40) break;
    const rawLat = element && element.lat != null ? element.lat : element && element.center && element.center.lat;
    const rawLon = element && element.lon != null ? element.lon : element && element.center && element.center.lon;
    const point = element && parseCoordinate(rawLat, rawLon);
    if (!point) continue;
    const category = categoryFromTags(element.tags);
    if (!category) continue;
    const rawName = element.tags && typeof element.tags.name === "string" ? element.tags.name.trim() : "";
    const name = rawName ? rawName.slice(0, 80) : unnamedAmenity(category);
    const osmType = element.type === "way" || element.type === "relation" ? element.type : "node";
    amenities.push({
      id: `osm-${osmType}-${element.id}`,
      name,
      category,
      lat: point.lat,
      lng: point.lng,
      provenance: `OpenStreetMap ${osmType} ${element.id}`,
      fixture: false,
    });
  }
  return amenities;
}

function amenityResult(status, items, provenance) {
  return assertNoPrivateLocationKeys({ status, items: items || [], provenance: provenance || null });
}

function cellKey(focus, categories) {
  const point = focusPoint(focus);
  if (!point) return "none";
  const radius = typeof focus.radiusM === "number" && Number.isFinite(focus.radiusM)
    ? Math.min(Math.max(focus.radiusM, 0), 2000)
    : 0;
  const cats = Array.isArray(categories) ? categories.join(",") : "";
  return `${point.lat},${point.lng},${radius},${cats}`;
}

function providerEnvUrl(input, name, normalize) {
  const raw = envString(envObject(input), name);
  if (!raw) return "";
  return typeof normalize === "function" ? normalize(raw) : raw;
}

function amenityProvider(input) {
  const selfUrl = providerEnvUrl(input, "OVERPASS_SELFHOSTED_URL");
  const publicUrl = providerEnvUrl(input, "OVERPASS_INTERPRETER_URL");
  if (selfUrl) return { id: "overpass-selfhosted", url: selfUrl };
  if (publicUrl) {
    const legacy = providerGate("overpass", input.registry);
    return { id: legacy.status === "absent" ? "overpass-public" : "overpass", url: publicUrl };
  }
  return null;
}

async function loadAmenitiesGuarded(input, focus, origin, providerId, envUrl, fetchImpl) {
  const radius = Math.min(focus.radiusM, 2000);
  const elements = Array.isArray(input.overpassElements) ? input.overpassElements : ["node", "way", "area"];
  const query = buildAmenityQuery({ radius, lat: origin.lat, lng: origin.lng, elements });
  const source = envObject(input);
  const gate = providerGate(providerId, input.registry);
  const decision = providerCanRun(providerId, { registry: input.registry, env: source, production: input.production });
  if (!decision.ok) return amenityResult("unconfigured", [], null);
  const guarded = await withProviderSafeguards({
    providerId,
    cacheKey: `${providerId}|${cellKey(focus, AMENITY_CATEGORIES)}`,
    cleared: gate.cleared,
    state: input.safeguardState,
    now: input.now,
    ttlMs: input.ttlMs,
    budgetLimit: input.budgetLimit,
    cachePolicy: input.cachePolicy || (decision.row && decision.row.cachePolicy),
    envSource: source,
    describeProvider: providerDescriber(input.registry),
  }, async () => {
    try {
      const response = await fetchAllowlisted({
        url: envUrl,
        allowedHosts: [new URL(envUrl).hostname],
        fetchImpl,
        lookup: input.lookup,
        timeoutMs: input.timeoutMs,
        maxBytes: input.maxBytes,
        init: withUserAgent({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
          cache: "no-store",
        }, userAgent(source)),
      });
      const statusCode = statusOf(response);
      if (!response || !response.ok) {
        return { statusCode, cacheable: false, value: amenityResult("failed", [], "OpenStreetMap") };
      }
      const parsed = parseOverpass(await response.json());
      if (!parsed) return { statusCode, cacheable: false, value: amenityResult("failed", [], "OpenStreetMap") };
      const servedBy = servedProviderId(response, providerId, input.registry);
      if (parsed.length === 0) {
        return { statusCode, cacheable: true, servedBy, value: amenityResult("empty", [], "OpenStreetMap") };
      }
      return { statusCode, cacheable: true, servedBy, value: amenityResult("ok", parsed, "OpenStreetMap") };
    } catch {
      return { statusCode: 0, cacheable: false, value: amenityResult("failed", [], "OpenStreetMap") };
    }
  });
  traceCache(input, providerId, guarded);
  if (guarded.outcome === "unconfigured" || guarded.outcome === "budget") return amenityResult("unconfigured", [], null);
  return guarded.value || amenityResult("failed", [], "OpenStreetMap");
}

async function loadAmenities(input = {}) {
  refuseUserSuppliedProviderUrl(input);
  const { focus, config, fetchImpl, allowFixtures } = input;
  if (allowFixtures) {
    throw new Error("live amenity loading cannot include fixtures");
  }
  const origin = focusPoint(focus);
  if (!origin || !focus.radiusM) return amenityResult("unavailable", [], null);
  const selected = amenityProvider(input);
  if (selected) {
    const configUrl = config && typeof config.overpassUrl === "string" ? config.overpassUrl.trim() : "";
    assertSameProviderUrl(selected.url, configUrl);
    return loadAmenitiesGuarded(input, focus, origin, selected.id, selected.url, fetchImpl);
  }
  const provider = config || readProviderConfig();
  if (!provider.overpassUrl) return amenityResult("unconfigured", [], null);
  const radius = Math.min(focus.radiusM, 2000);
  const query = LEGACY_AMENITY_QUERY(radius, origin.lat, origin.lng);
  try {
    const response = await fetchImpl(provider.overpassUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      cache: "no-store",
      signal: providerSignal(),
    });
    if (!response.ok) return amenityResult("failed", [], "OpenStreetMap");
    const parsed = parseOverpass(await response.json());
    if (!parsed) return amenityResult("failed", [], "OpenStreetMap");
    if (parsed.length === 0) return amenityResult("empty", [], "OpenStreetMap");
    return amenityResult("ok", parsed, "OpenStreetMap");
  } catch {
    return amenityResult("failed", [], "OpenStreetMap");
  }
}

function filterAmenities(items, category, allowFixtures) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    if (item.fixture === true && allowFixtures !== true) return false;
    if (category && category !== "all" && item.category !== category) return false;
    return AMENITY_CATEGORIES.includes(item.category);
  });
}

function amenityMessage(status) {
  if (status === "ok") return null;
  if (status === "empty") return "No shops, pharmacies, clinics, or transport stops were returned for this area.";
  if (status === "failed") return "We could not load nearby places. Nothing was added in their place.";
  if (status === "unconfigured") return "Nearby places are not connected yet. Nothing was added in their place.";
  if (status === "unavailable") return "Nearby places need a published location. Nothing was added in their place.";
  return "We could not load nearby places. Nothing was added in their place.";
}

function mapGeometry(focus) {
  const point = focusPoint(focus);
  if (focus && focus.precision === "approximate" && point && typeof focus.radiusM === "number") {
    return { kind: "area", lat: point.lat, lng: point.lng, radiusM: focus.radiusM };
  }
  if (exactPinPermitted(focus, true) && point) {
    return { kind: "pin", lat: point.lat, lng: point.lng };
  }
  return { kind: "none" };
}

function previewFocus(scenario) {
  if (scenario === "exact") {
    return {
      precision: "exact",
      fixturePin: true,
      label: FIXTURE_PIN.label,
      lat: FIXTURE_PIN.lat,
      lng: FIXTURE_PIN.lng,
    };
  }
  if (scenario === "area-only") {
    return { precision: "area-only", label: "Owerri West, Imo" };
  }
  if (scenario === "unknown" || scenario === "unavailable") {
    return { precision: "unknown", label: "Location not published" };
  }
  return {
    precision: "approximate",
    label: FIXTURE_AREA.label,
    lat: FIXTURE_AREA.lat,
    lng: FIXTURE_AREA.lng,
    radiusM: FIXTURE_AREA.radiusM,
  };
}

function previewAmenities(scenario) {
  if (scenario === "no-amenities") return amenityResult("empty", [], "DEV fixture");
  if (scenario === "amenities-failed") return amenityResult("failed", [], "DEV fixture");
  if (scenario === "unknown" || scenario === "unavailable" || scenario === "area-only") return amenityResult("unavailable", [], null);
  return amenityResult("ok", FIXTURE_AMENITIES.map((item) => ({ ...item })), "DEV fixture");
}

function previewRouteStatus(scenario) {
  if (scenario === "routing-failed") return "failed";
  if (scenario === "unknown" || scenario === "unavailable" || scenario === "area-only") return "unavailable";
  return "unconfigured";
}

function buildPreviewModel(scenario, campusId) {
  const name = scenario || "approximate";
  if (name === "unavailable") return null;
  const focus = previewFocus(name);
  const campus = campusById(campusId || "fpno");
  const route = {
    status: previewRouteStatus(name),
    distanceM: null,
    durationS: null,
    origin: focus.precision,
  };
  return assertNoPrivateLocationKeys({
    fixture: true,
    inventory: "excluded",
    listingId: null,
    title: "DEV fixture · area near Nekede",
    focus,
    disclaimer: DISCLAIMER,
    evidenceVerified: false,
    reviewForDisplay: false,
    allowExactOrigin: focus.precision === "exact" && focus.fixturePin === true,
    enquiry: false,
    amenities: previewAmenities(name),
    route,
    campusId: campus ? campus.id : null,
  });
}

function focusableElements(root) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  return Array.from(root.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
    .filter((element) => element && !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
}

function nextDialogFocus(elements, current, backwards) {
  if (!Array.isArray(elements) || elements.length === 0) return null;
  const index = elements.indexOf(current);
  if (index < 0) return backwards ? elements[elements.length - 1] : elements[0];
  const next = index + (backwards ? -1 : 1);
  if (next < 0) return elements[elements.length - 1];
  if (next >= elements.length) return elements[0];
  return elements[next];
}

function fillTileTemplate(template, tile) {
  if (typeof template !== "string" || !template.includes("{z}") || !template.includes("{x}") || !template.includes("{y}")) {
    return null;
  }
  if (!/^https:\/\//.test(template)) return null;
  return template
    .replaceAll("{z}", String(tile.z))
    .replaceAll("{x}", String(tile.x))
    .replaceAll("{y}", String(tile.y));
}

module.exports = {
  DISCLAIMER,
  ROUTING_UNAVAILABLE,
  PRIVATE_LOCATION_KEYS,
  AMENITY_CATEGORIES,
  CATEGORY_LABEL,
  CAMPUSES,
  FIXTURE_AREA,
  FIXTURE_PIN,
  FIXTURE_AMENITIES,
  parseCoordinate,
  isFixtureRecord,
  focusFromPublicListing,
  exactPinPermitted,
  spatialPublicationDecision,
  buildPublicSpatialContext,
  adaptSpatialListing,
  anonymousListingRequest,
  straightLineMeters,
  straightLineLabel,
  externalDirectionsUrl,
  urlLeaksCoordinates,
  readProviderConfig,
  describeRoute,
  loadRoute,
  loadAmenities,
  parseOverpass,
  filterAmenities,
  amenityMessage,
  mapGeometry,
  buildPreviewModel,
  campusById,
  fillTileTemplate,
  publicTileTemplate,
  publicSubject,
  focusableElements,
  nextDialogFocus,
  configureSpatialCore,
  ALLOWED_LAYERS,
  BANNED_LAYERS,
  assertLayerId,
  DATA_SOURCE_REVISION,
  dataSources,
  providerGate,
  providerRegistry,
  providerCanRun,
  providerFallback,
  COMMERCIAL_CLASSES,
  PROVIDER_CATEGORIES,
  refuseUserSuppliedProviderUrl,
  cellKey,
  stripPrivateLocationKeys,
  assertNoPrivateLocationKeys,
  createSafeguardState,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_DAILY_BUDGET,
  PROVIDER_BACKOFF_MS,
  DEFAULT_USER_AGENT,
  cachePermitted,
};
