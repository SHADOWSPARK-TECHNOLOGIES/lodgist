// N2: request and coordinate validation for GET /api/neighborhood/nearby.
const { isCategory, CATEGORIES } = require("./categories");

const RADIUS_DEFAULT_M = 1500;
// Presets only, so each listing has at most 4 × 10 distinct Google queries.
const RADIUS_PRESETS_M = Object.freeze([500, 1000, 1500, 3000]);
// Callers may only name a listing; the server owns the coordinates.
const FORBIDDEN_PARAMS = ["lat", "lng", "lon", "long", "latitude", "longitude", "location"];

function fail(error) {
  return { ok: false, status: 400, code: "INVALID_REQUEST", error };
}

function parseNearbyQuery(query = {}) {
  const forbidden = FORBIDDEN_PARAMS.filter((p) => query[p] !== undefined);
  if (forbidden.length) return fail("Coordinates are not accepted. Send listingId only.");

  const rawId = query.listingId;
  if (typeof rawId !== "string" || !/^\d{1,10}$/.test(rawId) || Number(rawId) < 1 || Number(rawId) > 2147483647) {
    return fail("listingId must be a positive integer.");
  }

  let radiusM = RADIUS_DEFAULT_M;
  if (query.radiusM !== undefined) {
    if (typeof query.radiusM !== "string" || !RADIUS_PRESETS_M.map(String).includes(query.radiusM)) {
      return fail(`radiusM must be one of: ${RADIUS_PRESETS_M.join(", ")}.`);
    }
    radiusM = Number(query.radiusM);
  }

  let category = null;
  if (query.category !== undefined && query.category !== "") {
    if (!isCategory(query.category)) return fail(`category must be one of: ${CATEGORIES.join(", ")}.`);
    category = query.category;
  }

  return { ok: true, listingId: Number(rawId), radiusM, category };
}

// A usable pair: both finite numbers, in range, and not the 0,0 placeholder.
function isUsableCoordinate(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

module.exports = {
  RADIUS_DEFAULT_M,
  RADIUS_PRESETS_M,
  FORBIDDEN_PARAMS,
  parseNearbyQuery,
  isUsableCoordinate,
};
