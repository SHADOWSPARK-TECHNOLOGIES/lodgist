// Federal Polytechnic Nekede campus point from OpenStreetMap Nominatim,
// amenity=university, checked 2026-10-03. It is a campus point, not a gate.
const NEKEDE = {
  name: "Federal Polytechnic Nekede",
  lat: 5.4333523,
  lng: 7.0339554,
};

function finiteCoord(value, max) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= max;
}

function validApprox(approx) {
  if (!approx || typeof approx !== "object") return null;
  if (!finiteCoord(approx.lat, 90) || !finiteCoord(approx.lng, 180)) return null;
  return { lat: approx.lat, lng: approx.lng };
}

function isNekede(place) {
  return typeof place === "string" && /nekede/i.test(place);
}

function kilometres(from, to) {
  const earth = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}

function areaSearchUrl(placeText) {
  if (!placeText || placeText === "Area is not listed.") return null;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(placeText)}`;
}

function campusDirections({ place, approx }) {
  const placeText = typeof place === "string" && place.trim() ? place.trim() : "Area is not listed.";
  const pin = validApprox(approx);
  const mapUrl = areaSearchUrl(placeText);
  if (!pin) {
    return {
      placeText,
      mapUrl,
      pinNote: "No map pin is on file.",
      distanceText: "Distance to campus is not measured yet.",
    };
  }
  if (!isNekede(placeText)) {
    return {
      placeText,
      mapUrl,
      pinNote: "A published area is not the door. This link uses the area name, not a coordinate.",
      distanceText: "Distance to campus is not measured for this area yet.",
    };
  }
  const km = kilometres(pin, NEKEDE);
  const distanceText =
    km < 1
      ? `Under 1 km straight-line from the 500 m area to ${NEKEDE.name}. This is not a road distance or a door-to-gate measurement.`
      : `About ${Math.round(km)} km straight-line from the 500 m area to ${NEKEDE.name}. This is not a road distance or a door-to-gate measurement.`;
  return {
    placeText,
    mapUrl,
    pinNote: "The published point is an area of about 500 m, not the door. The link uses the area name, not that point.",
    distanceText,
  };
}

module.exports = { campusDirections };
