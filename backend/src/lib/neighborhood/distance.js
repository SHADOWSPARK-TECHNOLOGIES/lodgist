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

const NEAR_THRESHOLD_M = 200;

// Coarse public distances measured from the snapped point:
//   under 200 m -> 200 (labelled "under 200 m")
//   under 1 km  -> nearest 100 m
//   1 km and up -> nearest 0.5 km
function roundDistanceMeters(m) {
  if (!Number.isFinite(m) || m < 0) return null;
  if (m < NEAR_THRESHOLD_M) return NEAR_THRESHOLD_M;
  if (m < 1000) return Math.round(m / 100) * 100;
  return Math.round(m / 500) * 500;
}

function distanceLabel(m) {
  if (!Number.isFinite(m) || m < 0) return null;
  if (m < NEAR_THRESHOLD_M) return "under 200 m";
  const rounded = roundDistanceMeters(m);
  if (rounded < 1000) return `${rounded} m`;
  return `${rounded / 1000} km`;
}

// Same 0.005° grid as PR #18's public approxLocation. Returns null when unusable.
function snapToApproxGrid(lat, lng) {
  return approxLocation(lat, lng);
}

module.exports = { haversineMeters, roundDistanceMeters, distanceLabel, snapToApproxGrid };
