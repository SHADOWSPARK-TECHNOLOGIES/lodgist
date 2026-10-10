/**
 * Overpass amenity query builder. Way and area geometry are opt-in for the
 * cleared provider path. The legacy node query stays byte-identical.
 * Reimplemented; GEV's query sanitizer is coupled to its proxy constants.
 */

const LEGACY_AMENITY_QUERY = (radius, lat, lng) => `[out:json][timeout:12];(node["amenity"="pharmacy"](around:${radius},${lat},${lng});node["amenity"="clinic"](around:${radius},${lat},${lng});node["amenity"="doctors"](around:${radius},${lat},${lng});node["amenity"="hospital"](around:${radius},${lat},${lng});node["shop"](around:${radius},${lat},${lng});node["highway"="bus_stop"](around:${radius},${lat},${lng});node["amenity"="bus_station"](around:${radius},${lat},${lng}););out body 40;`;

const FILTERS = [
  '["amenity"="pharmacy"]',
  '["amenity"="clinic"]',
  '["amenity"="doctors"]',
  '["amenity"="hospital"]',
  '["shop"]',
  '["highway"="bus_stop"]',
  '["amenity"="bus_station"]',
];

function buildAmenityQuery(input) {
  const radius = Math.min(Math.max(Number(input.radius) || 0, 0), 2000);
  const lat = input.lat;
  const lng = input.lng;
  const kinds = Array.isArray(input.elements) && input.elements.length ? input.elements : ["node"];
  if (kinds.length === 1 && kinds[0] === "node") return LEGACY_AMENITY_QUERY(radius, lat, lng);
  const parts = [];
  kinds.forEach((kind) => {
    const element = kind === "area" ? "relation" : kind === "way" ? "way" : kind === "node" ? "node" : null;
    if (!element) return;
    FILTERS.forEach((filter) => {
      parts.push(`${element}${filter}(around:${radius},${lat},${lng})`);
    });
  });
  const geom = kinds.some((kind) => kind === "way" || kind === "area");
  return `[out:json][timeout:12];(${parts.join("")});${geom ? "out center 40;" : "out body 40;"}`;
}

module.exports = { LEGACY_AMENITY_QUERY, buildAmenityQuery };
