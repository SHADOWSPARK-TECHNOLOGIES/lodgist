/**
 * Cross-reference engine. Sources stay independent: a disagreement is a
 * conflict, not a merged value. Location inputs are listing or campus ids.
 * Raw coordinates are refused. Reimplemented from the God's Eye View area
 * argument and live-source freshness rule; GEV's coordinate area is not used.
 */
const {
  AMENITY_CATEGORIES,
  ALLOWED_LAYERS,
  BANNED_LAYERS,
  campusById,
  focusFromPublicListing,
  straightLineMeters,
  straightLineLabel,
  spatialPublicationDecision,
  DATA_SOURCE_REVISION,
  dataSources,
} = require("./core.cjs");
const { assertNoPrivateLocationKeys, stripPrivateLocationKeys } = require("./privacy.cjs");

const CLASSIFICATIONS = Object.freeze(["VERIFIED", "OBSERVED", "DERIVED", "ESTIMATED", "UNKNOWN"]);
const CANONICAL_CATEGORIES = Object.freeze(["shop", "pharmacy", "clinic", "transport"]);
const LAB_LAYER_TO_CATEGORY = Object.freeze({
  hospitals: "clinic",
  schools: null,
  markets: "shop",
  pharmacies: "pharmacy",
  roads: null,
});
const TRANSIT_POLICY = Object.freeze({
  id: "transit",
  status: "undecided",
  enabled: false,
  reason: "Spatial Lab has not decided whether transit is allowed. It stays off.",
});
const RAW_COORDINATE_KEYS = Object.freeze([
  "lat",
  "lng",
  "lon",
  "latitude",
  "longitude",
  "bbox",
  "coordinates",
  "radius_km",
  "area",
]);
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const SPATIAL_LAB_CONTRACT = Object.freeze({
  revision: "a922a3bfa86683ab008dbada0a37a3c956760eb7",
  allowedLayers: ["hospitals", "schools", "markets", "pharmacies", "roads"],
  bannedLayers: ["flights", "military", "vessels", "satellites", "cctv", "alpr", "radio", "cables", "firms", "earthquakes"],
  amenityCategories: ["shop", "pharmacy", "clinic", "transport"],
  providerIds: ["overpass", "tiles", "geocoder", "imagery", "weather", "traffic"],
  transit: "undecided",
});

function refuseRawCoordinates(value, label) {
  if (!value || typeof value !== "object") return;
  for (const key of RAW_COORDINATE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const present = value[key];
    if (present == null || present === "") continue;
    throw new Error(`${label} refuses raw coordinates`);
  }
}

function finiteTimestamp(value) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

function freshnessOf(observedAt, now, staleAfterMs) {
  if (observedAt == null) return "unknown";
  if (now - observedAt > staleAfterMs) return "stale";
  return "fresh";
}

function classificationOf(value) {
  return CLASSIFICATIONS.includes(value) ? value : "UNKNOWN";
}

function confidenceOf(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function normalizeObservation(row, providerId, now, staleAfterMs) {
  const source = row && typeof row === "object" ? row : {};
  const observedAt = finiteTimestamp(source.observedAt);
  const coverage = typeof source.coverage === "string" ? source.coverage : null;
  return {
    subjectId: source.subjectId == null ? null : String(source.subjectId),
    provider: typeof source.provider === "string" && source.provider ? source.provider : providerId || null,
    kind: typeof source.kind === "string" ? source.kind : "unknown",
    fact: typeof source.fact === "string" ? source.fact : "",
    value: source.value === undefined ? null : source.value,
    observedAt,
    retrievedAt: finiteTimestamp(source.retrievedAt),
    freshness: freshnessOf(observedAt, now, staleAfterMs),
    confidence: confidenceOf(source.confidence),
    classification: classificationOf(source.classification),
    coverage,
    source: typeof source.source === "string" ? source.source : null,
    license: typeof source.license === "string" ? source.license : null,
  };
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function rollupFreshness(observations) {
  if (!observations.length) return "unknown";
  if (observations.some((item) => item.freshness === "unknown")) return "unknown";
  if (observations.some((item) => item.freshness === "stale")) return "stale";
  return "fresh";
}

function crossReference(input = {}) {
  refuseRawCoordinates(input.location, "location");
  refuseRawCoordinates(input.constraints, "constraints");
  const now = finiteTimestamp(input.now) || Date.now();
  const staleAfterMs = typeof input.staleAfterMs === "number" && input.staleAfterMs >= 0
    ? input.staleAfterMs
    : DEFAULT_STALE_AFTER_MS;
  const providers = Array.isArray(input.providers) ? input.providers : [];
  const subjects = Array.isArray(input.subjects) ? input.subjects.map((id) => String(id)) : [];
  const requiredFacts = input.constraints && Array.isArray(input.constraints.requiredFacts)
    ? input.constraints.requiredFacts.filter((fact) => typeof fact === "string")
    : [];
  const observations = [];
  const silentProviders = [];

  providers.forEach((provider) => {
    const providerId = provider && typeof provider.id === "string" ? provider.id : null;
    const rows = provider && Array.isArray(provider.observations) ? provider.observations : [];
    if (!rows.length) {
      silentProviders.push(providerId);
      return;
    }
    rows.forEach((row) => {
      observations.push(normalizeObservation(row, providerId, now, staleAfterMs));
    });
  });

  const groups = new Map();
  observations.forEach((item) => {
    const key = `${item.subjectId}\0${item.fact}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  });

  const agreements = [];
  const conflicts = [];
  groups.forEach((group) => {
    const distinct = [];
    group.forEach((item) => {
      if (!distinct.some((value) => sameValue(value, item.value))) distinct.push(item.value);
    });
    const entry = {
      subjectId: group[0].subjectId,
      fact: group[0].fact,
      values: group.map((item) => ({
        provider: item.provider,
        value: item.value,
        observedAt: item.observedAt,
        freshness: item.freshness,
        confidence: item.confidence,
        classification: item.classification,
      })),
    };
    if (distinct.length > 1) conflicts.push(entry);
    else if (group.length > 1) agreements.push(entry);
  });

  const missing = [];
  silentProviders.forEach((provider) => {
    missing.push({ provider, subjectId: null, fact: null, reason: "provider-silent" });
  });
  subjects.forEach((subjectId) => {
    const seen = observations.some((item) => item.subjectId === subjectId);
    if (!seen) missing.push({ provider: null, subjectId, fact: null, reason: "subject-missing" });
  });
  requiredFacts.forEach((fact) => {
    const seen = observations.some((item) => item.fact === fact);
    if (!seen) missing.push({ provider: null, subjectId: null, fact, reason: "fact-missing" });
  });

  const provenance = [];
  observations.forEach((item) => {
    const stamp = {
      provider: item.provider,
      source: item.source,
      license: item.license,
      retrievedAt: item.retrievedAt,
    };
    if (!provenance.some((existing) => sameValue(existing, stamp))) provenance.push(stamp);
  });

  return assertNoPrivateLocationKeys(stripPrivateLocationKeys({
    observations,
    agreements,
    conflicts,
    missing,
    freshness: rollupFreshness(observations),
    provenance,
    coverage: observations.map((item) => item.coverage),
  }));
}

function publishedListing(listing, predicate) {
  if (!listing || typeof listing !== "object") return false;
  if (listing.fixture === true || listing.inventory === "excluded") return false;
  if (typeof predicate === "function") return predicate(listing) === true;
  return spatialPublicationDecision(listing).published === true;
}

function relateListingToCampus(input = {}) {
  refuseRawCoordinates(input, "listing-campus relation");
  const listingId = input.listingId;
  const campusId = typeof input.campusId === "string" ? input.campusId : "";
  if (listingId == null || listingId === "" || !campusId) {
    throw new Error("listing-campus relation requires listingId and campusId");
  }
  const listings = Array.isArray(input.listings) ? input.listings : [];
  const listing = listings.find((item) => item && String(item.id) === String(listingId)) || null;
  if (!publishedListing(listing, input.isPublicListing)) {
    return assertNoPrivateLocationKeys({
      listingId,
      campusId,
      status: "unavailable",
      straightLineLabel: null,
      travelTime: null,
    });
  }
  const campus = campusById(campusId);
  const focus = focusFromPublicListing(listing);
  const meters = campus && focus.precision === "approximate"
    ? straightLineMeters({ lat: focus.lat, lng: focus.lng }, campus)
    : null;
  return assertNoPrivateLocationKeys(stripPrivateLocationKeys({
    listingId: listing.id,
    campusId,
    campusName: campus ? campus.name : null,
    status: campus ? "related" : "unknown-campus",
    straightLineLabel: straightLineLabel(meters),
    travelTime: null,
  }));
}

function publicProjection(listing) {
  const focus = focusFromPublicListing(listing);
  return {
    id: listing.id,
    category: typeof listing.category === "string" ? listing.category : null,
    locationState: focus.precision,
    areaLabel: focus.label || null,
  };
}

function compareListings(input = {}) {
  refuseRawCoordinates(input, "compare");
  const ids = Array.isArray(input.listingIds) ? input.listingIds : [];
  if (ids.length !== 2) throw new Error("compare requires two listing ids");
  const listings = Array.isArray(input.listings) ? input.listings : [];
  const projections = ids.map((id) => {
    const listing = listings.find((item) => item && String(item.id) === String(id)) || null;
    if (!publishedListing(listing, input.isPublicListing)) return { id, available: false };
    return { available: true, ...publicProjection(listing) };
  });
  const facts = ["category", "locationState", "areaLabel"];
  const comparisons = facts.map((fact) => {
    const values = {};
    projections.forEach((item) => {
      values[String(item.id)] = item.available ? item[fact] : null;
    });
    const present = projections.filter((item) => item.available).map((item) => item[fact]);
    return {
      fact,
      values,
      agreement: present.length === 2 && sameValue(present[0], present[1]),
    };
  });
  return assertNoPrivateLocationKeys(stripPrivateLocationKeys({
    listingIds: ids.map((id) => projections.find((item) => String(item.id) === String(id)) ? id : id),
    comparisons,
  }));
}

function mapLabLayer(layerId) {
  if (layerId === "transit") return null;
  if (!Object.prototype.hasOwnProperty.call(LAB_LAYER_TO_CATEGORY, layerId)) return null;
  return LAB_LAYER_TO_CATEGORY[layerId];
}

function listDifference(label, expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  const differences = [];
  if (missing.length) differences.push({ field: label, missing, extra: [] });
  if (extra.length) differences.push({ field: label, missing: [], extra });
  return differences;
}

function spatialLabDrift(live) {
  const current = live || {
    revision: DATA_SOURCE_REVISION,
    allowedLayers: [...ALLOWED_LAYERS],
    bannedLayers: [...BANNED_LAYERS],
    amenityCategories: [...AMENITY_CATEGORIES],
    providerIds: dataSources().map((row) => row.id),
    transit: TRANSIT_POLICY.status,
  };
  const differences = [
    ...listDifference("allowedLayers", SPATIAL_LAB_CONTRACT.allowedLayers, current.allowedLayers || []),
    ...listDifference("bannedLayers", SPATIAL_LAB_CONTRACT.bannedLayers, current.bannedLayers || []),
    ...listDifference("amenityCategories", SPATIAL_LAB_CONTRACT.amenityCategories, current.amenityCategories || []),
    ...listDifference("providerIds", SPATIAL_LAB_CONTRACT.providerIds, current.providerIds || []),
  ];
  if (current.revision !== SPATIAL_LAB_CONTRACT.revision) {
    differences.push({
      field: "revision",
      expected: SPATIAL_LAB_CONTRACT.revision,
      actual: current.revision,
    });
  }
  if (current.transit !== SPATIAL_LAB_CONTRACT.transit) {
    differences.push({ field: "transit", expected: SPATIAL_LAB_CONTRACT.transit, actual: current.transit });
  }
  return {
    revision: SPATIAL_LAB_CONTRACT.revision,
    differences,
    transit: TRANSIT_POLICY,
  };
}

function buildSpatialContext(input = {}) {
  refuseRawCoordinates(input, "spatial context");
  const listing = input.listing;
  if (!publishedListing(listing, input.isPublicListing)) return null;
  const focus = focusFromPublicListing(listing);
  const campusId = typeof input.campusId === "string" && input.campusId ? input.campusId : null;
  const relation = campusId
    ? relateListingToCampus({
      listingId: listing.id,
      campusId,
      listings: [listing],
      isPublicListing: input.isPublicListing,
    })
    : null;
  const report = crossReference({
    location: { listingId: listing.id, campusId },
    subjects: input.subjects,
    providers: input.providers,
    constraints: input.constraints,
    now: input.now,
    staleAfterMs: input.staleAfterMs,
  });
  const approx = focus.precision === "approximate"
    ? { lat: focus.lat, lng: focus.lng, radiusM: focus.radiusM }
    : null;
  return assertNoPrivateLocationKeys(stripPrivateLocationKeys({
    listingId: listing.id,
    title: typeof listing.title === "string" ? listing.title : "Home",
    locationState: focus.precision,
    areaLabel: focus.label,
    approxLocation: approx,
    campusId,
    straightLineLabel: campusId ? relation.straightLineLabel : null,
    travelTime: null,
    ...report,
  }));
}

module.exports = {
  CLASSIFICATIONS,
  CANONICAL_CATEGORIES,
  LAB_LAYER_TO_CATEGORY,
  TRANSIT_POLICY,
  SPATIAL_LAB_CONTRACT,
  crossReference,
  relateListingToCampus,
  compareListings,
  mapLabLayer,
  spatialLabDrift,
  buildSpatialContext,
};
