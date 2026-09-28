// N3: distance, rounding and privacy snapping.
const { approxLocation } = require("../../routes/listings");

const EARTH_RADIUS_M = 6371008.8;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Under 1 km: nearest 100 m. From 1 km: nearest 0.1 km, which is also 100 m, so
// both rules reduce to one integer step (avoids float noise like 1100.0000000000002).
function roundDistanceMeters(m) {
  if (!Number.isFinite(m) || m < 0) return null;
  return Math.round(m / 100) * 100;
}

// Same 0.005° grid as PR #18's public approxLocation. Returns null when unusable.
function snapToApproxGrid(lat, lng) {
  return approxLocation(lat, lng);
}

module.exports = { haversineMeters, roundDistanceMeters, snapToApproxGrid };
