const { CAMPUSES, straightLineMeters } = require("@lodgist/spatial-core");

const NEKEDE = CAMPUSES.find((campus) => campus.id === "fpno");

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
  const meters = straightLineMeters(from, to);
  if (typeof meters !== "number") return null;
  return meters / 1000;
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
  if (typeof km !== "number" || !NEKEDE) {
    return {
      placeText,
      mapUrl,
      pinNote: "The published point is an area of about 500 m, not the door. The link uses the area name, not that point.",
      distanceText: "Distance to campus is not measured yet.",
    };
  }
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
