/**
 * Public campus areas for Spatial Lab.
 * Coordinates are OpenStreetMap area centers (ODbL 1.0), not building doors
 * and not Lodgist surveys. © OpenStreetMap contributors.
 * https://www.openstreetmap.org/copyright
 *
 * Federal University of Technology Owerri is omitted: Nominatim returned a
 * motorway junction and a road, not a campus area.
 */

const CAMPUSES = [
  {
    id: "fpno",
    name: "Federal Polytechnic Nekede",
    lat: 5.4333523,
    lng: 7.0339554,
    kind: "campus-area",
    provenance: "OpenStreetMap relation 12519494 area center. Not a building door.",
    licence: "ODbL 1.0",
  },
  {
    id: "imsu",
    name: "Imo State University",
    lat: 5.5052274,
    lng: 7.044657,
    kind: "campus-area",
    provenance: "OpenStreetMap way 797998350 area center. Not a building door.",
    licence: "ODbL 1.0",
  },
];

function campusById(id) {
  if (typeof id !== "string" || !id) return null;
  return CAMPUSES.find((campus) => campus.id === id) || null;
}

module.exports = { CAMPUSES, campusById };
