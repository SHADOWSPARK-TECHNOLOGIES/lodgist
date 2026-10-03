const { isPublicListing } = require("./listingHonesty");
const { CAMPUSES, campusById } = require("./spatialCampuses");

const DISCLAIMER =
  "A map does not show who owns this home, what condition it is in, whether it is available, or whether the area is safe.";

const ROUTING_UNAVAILABLE = "Routing unavailable";

const PRIVATE_LOCATION_KEYS = new Set([
  "latitude",
  "longitude",
  "address",
  "landmark",
  "exactLat",
  "exactLng",
  "exactLatitude",
  "exactLongitude",
]);

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

function placeLabel(listing) {
  const property = listing && listing.property;
  if (!property || typeof property !== "object") return "Location not published";
  const parts = [property.lga, property.city, property.state].filter((part) => typeof part === "string" && part.trim());
  return parts.length ? parts.join(", ") : "Location not published";
}

/**
 * Public listings never become an exact pin. A snapped area center is an
 * approximate circle only when radius_m is an explicit finite radius.
 */
function focusFromPublicListing(listing) {
  const label = placeLabel(listing);
  const approx = listing && listing.approxLocation;
  if (!approx || typeof approx !== "object") {
    return { precision: "unknown", label };
  }
  const point = parseCoordinate(approx.lat, approx.lng);
  const radius = approx.radius_m;
  if (!point || typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0 || radius > 20000) {
    return { precision: "unknown", label };
  }
  return {
    precision: "approximate",
    label,
    lat: point.lat,
    lng: point.lng,
    radiusM: radius,
  };
}

function spatialPublicationDecision(listing) {
  if (!listing || typeof listing !== "object") return { published: false, reason: "missing" };
  if (isFixtureRecord(listing)) return { published: false, reason: "fixture" };
  if (!isPublicListing(listing)) return { published: false, reason: "unpublished" };
  return { published: true, reason: "public" };
}

function ownKeys(value, into) {
  if (!value || typeof value !== "object") return;
  const entries = Array.isArray(value) ? value : Object.entries(value);
  if (Array.isArray(value)) {
    value.forEach((item) => ownKeys(item, into));
    return;
  }
  Object.keys(value).forEach((key) => into.add(key));
  entries.forEach((entry) => ownKeys(entry[1], into));
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
  };
  const keys = new Set();
  ownKeys(context, keys);
  PRIVATE_LOCATION_KEYS.forEach((key) => {
    if (keys.has(key)) {
      throw new Error("public spatial context exposed a private location field");
    }
  });
  return context;
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
  const allowExact = input.allowExactOrigin === true && input.precision === "exact" && input.fixturePin === true && exact;
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
  };
}

function describeRoute(result) {
  if (!result || result.status !== "ok") {
    const detail = {
      "needs-campus": "Select a campus. A road route is not shown yet.",
      unconfigured: "No routing provider is configured.",
      failed: "The routing provider did not return a route.",
      unavailable: "This home has no published location to route from.",
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

async function loadRoute({ focus, campus, config, fetchImpl }) {
  const empty = (status) => ({ status, distanceM: null, durationS: null, origin: focus && focus.precision });
  if (!campus) return empty("needs-campus");
  const origin = focusPoint(focus);
  if (!origin) return empty("unavailable");
  const provider = config || readProviderConfig();
  if (!provider.osrmBaseUrl) return empty("unconfigured");
  const dest = parseCoordinate(campus.lat, campus.lng);
  if (!dest) return empty("failed");
  const path = `/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
  try {
    const response = await fetchImpl(`${provider.osrmBaseUrl}${path}`, { cache: "no-store" });
    if (!response.ok) return empty("failed");
    const body = await response.json();
    const route = body && Array.isArray(body.routes) ? body.routes[0] : null;
    if (!route || typeof route.distance !== "number" || typeof route.duration !== "number") return empty("failed");
    if (!Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return empty("failed");
    return {
      status: "ok",
      distanceM: route.distance,
      durationS: route.duration,
      origin: focus.precision,
    };
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
    const point = element && parseCoordinate(element.lat, element.lon);
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
  return { status, items: items || [], provenance: provenance || null };
}

async function loadAmenities({ focus, config, fetchImpl, allowFixtures }) {
  if (allowFixtures) {
    throw new Error("live amenity loading cannot include fixtures");
  }
  const origin = focusPoint(focus);
  if (!origin || !focus.radiusM) return amenityResult("unavailable", [], null);
  const provider = config || readProviderConfig();
  if (!provider.overpassUrl) return amenityResult("unconfigured", [], null);
  const radius = Math.min(focus.radiusM, 2000);
  const query = `[out:json][timeout:12];(node["amenity"="pharmacy"](around:${radius},${origin.lat},${origin.lng});node["amenity"="clinic"](around:${radius},${origin.lat},${origin.lng});node["amenity"="doctors"](around:${radius},${origin.lat},${origin.lng});node["amenity"="hospital"](around:${radius},${origin.lat},${origin.lng});node["shop"](around:${radius},${origin.lat},${origin.lng});node["highway"="bus_stop"](around:${radius},${origin.lat},${origin.lng});node["amenity"="bus_station"](around:${radius},${origin.lat},${origin.lng}););out body 40;`;
  try {
    const response = await fetchImpl(provider.overpassUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      cache: "no-store",
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
  if (focus && focus.precision === "exact" && focus.fixturePin === true && point) {
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
  if (scenario === "unknown" || scenario === "unavailable") return amenityResult("unavailable", [], null);
  return amenityResult("ok", FIXTURE_AMENITIES.map((item) => ({ ...item })), "DEV fixture");
}

function previewRouteStatus(scenario) {
  if (scenario === "routing-failed") return "failed";
  if (scenario === "unknown" || scenario === "unavailable") return "unavailable";
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
  return {
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
  };
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
  spatialPublicationDecision,
  buildPublicSpatialContext,
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
};
