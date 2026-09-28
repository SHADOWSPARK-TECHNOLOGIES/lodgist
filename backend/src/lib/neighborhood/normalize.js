// N5: turn raw Google places into the Lodgist DTO. Nothing else from Google passes through.
const { categoryForTypes } = require("./categories");
const { haversineMeters, roundDistanceMeters, distanceLabel } = require("./distance");
const { isUsableCoordinate } = require("./validation");

const MAX_RESULTS = 20;

function normalizePlace(place, origin, requestedCategory) {
  if (!place || typeof place !== "object") return null;
  const id = typeof place.id === "string" ? place.id : null;
  const name = place.displayName && typeof place.displayName.text === "string" ? place.displayName.text.trim() : "";
  const lat = place.location && place.location.latitude;
  const lng = place.location && place.location.longitude;
  if (!id || !name || !isUsableCoordinate(lat, lng)) return null;

  const category = requestedCategory || categoryForTypes(place.primaryType, place.types);
  if (!category) return null;

  const rawDistance = haversineMeters(origin.lat, origin.lng, lat, lng);
  const dto = {
    id,
    name,
    category,
    distanceMeters: roundDistanceMeters(rawDistance),
    distanceLabel: distanceLabel(rawDistance),
    lat,
    lng,
  };
  if (typeof place.formattedAddress === "string" && place.formattedAddress) dto.address = place.formattedAddress;
  return { dto, rawDistance };
}

// origin must be the snapped point, never the exact property location.
function normalizePlaces(places, origin, requestedCategory = null) {
  const seen = new Set();
  const out = [];
  for (const p of Array.isArray(places) ? places : []) {
    const n = normalizePlace(p, origin, requestedCategory);
    if (!n || seen.has(n.dto.id)) continue;
    seen.add(n.dto.id);
    out.push(n);
  }
  out.sort((a, b) => a.rawDistance - b.rawDistance);
  return out.slice(0, MAX_RESULTS).map((n) => n.dto);
}

module.exports = { MAX_RESULTS, normalizePlace, normalizePlaces };
