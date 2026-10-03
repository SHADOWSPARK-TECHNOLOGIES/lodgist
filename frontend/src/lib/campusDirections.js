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

function areaMapUrl(pin) {
  return `https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lng}#map=16/${pin.lat}/${pin.lng}`;
}

function campusMapUrl(pin) {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${pin.lat},${pin.lng};${NEKEDE.lat},${NEKEDE.lng}`;
}

function campusDirections({ place, approx }) {
  const placeText = typeof place === "string" && place.trim() ? place.trim() : "Area is not listed.";
  const pin = validApprox(approx);
  if (!pin) {
    return {
      placeText,
      mapUrl: null,
      pinNote: "No map pin is on file.",
      distanceText: "Distance to campus is not measured yet.",
    };
  }
  if (!isNekede(placeText)) {
    return {
      placeText,
      mapUrl: areaMapUrl(pin),
      pinNote: "The pin is an area of about 500 m, not the door.",
      distanceText: "Distance to campus is not measured for this area yet.",
    };
  }
  const km = kilometres(pin, NEKEDE);
  const distanceText =
    km < 1
      ? `Under 1 km from the 500 m area to ${NEKEDE.name}. This is not a door-to-gate measurement.`
      : `About ${Math.round(km)} km from the 500 m area to ${NEKEDE.name}. This is not a door-to-gate measurement.`;
  return {
    placeText,
    mapUrl: campusMapUrl(pin),
    pinNote: "The pin is an area of about 500 m, not the door.",
    distanceText,
  };
}

module.exports = { campusDirections };
