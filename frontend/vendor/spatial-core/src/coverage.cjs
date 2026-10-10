/**
 * Place-coverage quality from the offline Nigeria OSM benchmark.
 * Planning source: docs/benchmarks/nigeria-osm-2026-10-09.json
 * and docs/NIGERIA_SPATIAL_COVERAGE.md (extract 2026-10-09).
 *
 * Grades describe mapped OpenStreetMap data inside 3 km. They are not a
 * ground survey and they do not change a property score. Nekede stays
 * unverified: its benchmark grade is not repeated as a product claim.
 * Coordinates from the benchmark are not stored here.
 */
const COVERAGE_GRADES = Object.freeze(["GOOD", "PARTIAL", "POOR", "UNKNOWN"]);
const INCOMPLETE_WARNING = "Nearby-place coverage may be incomplete in this area.";
const UNVERIFIED_WARNING = "This location is unverified. Nearby-place coverage cannot be claimed for this area.";
const UNKNOWN_WARNING = "Nearby-place coverage is unknown for this area.";
const SAMPLE_NOTE = "Nearby places are a measured OpenStreetMap sample. A missing place is not proof it is absent.";
const DATA_NOTE = "This describes mapped data, not the property.";
const BENCHMARK_SOURCE = "docs/benchmarks/nigeria-osm-2026-10-09.json";

const PLACES = Object.freeze([
  { id: "uniport-choba", verified: true, grade: "PARTIAL", rank: 3, campusIds: [], terms: ["university of port harcourt", "uniport", "choba"] },
  { id: "rumuokoro", verified: true, grade: "POOR", rank: 2, campusIds: [], terms: ["rumuokoro"] },
  { id: "yaba-unilag", verified: true, grade: "GOOD", rank: 2, campusIds: [], terms: ["university of lagos", "unilag", "yaba"] },
  { id: "surulere", verified: true, grade: "GOOD", rank: 2, campusIds: [], terms: ["surulere"] },
  { id: "wuse", verified: true, grade: "PARTIAL", rank: 2, campusIds: [], terms: ["wuse"] },
  { id: "uniabuja", verified: true, grade: "POOR", rank: 3, campusIds: [], terms: ["university of abuja", "uniabuja"] },
  { id: "gwagwalada", verified: true, grade: "POOR", rank: 2, campusIds: [], terms: ["gwagwalada"] },
  { id: "owerri-town", verified: true, grade: "PARTIAL", rank: 1, campusIds: [], terms: ["owerri"] },
  { id: "imsu", verified: true, grade: "POOR", rank: 3, campusIds: ["imsu"], terms: ["imo state university", "imsu"] },
  { id: "futo", verified: true, grade: "POOR", rank: 3, campusIds: [], terms: ["federal university of technology owerri", "futo"] },
  { id: "nekede-poly", verified: false, grade: "POOR", rank: 3, campusIds: ["fpno"], terms: ["federal polytechnic nekede", "nekede", "fpno"] },
]);

function placeById(id) {
  return PLACES.find((place) => place.id === id) || null;
}

function hasTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
}

function matchPlace(input) {
  const campusId = typeof input.campusId === "string" ? input.campusId.trim().toLowerCase() : "";
  if (campusId) {
    const byCampus = PLACES.find((place) => place.campusIds.includes(campusId));
    if (byCampus) return byCampus;
  }
  const text = `${input.title || ""} ${input.label || ""}`.toLowerCase();
  let best = null;
  let bestRank = -1;
  let bestLength = -1;
  PLACES.forEach((place) => {
    place.terms.forEach((term) => {
      if (!hasTerm(text, term)) return;
      const rank = place.rank || 0;
      if (rank > bestRank || (rank === bestRank && term.length > bestLength)) {
        best = place;
        bestRank = rank;
        bestLength = term.length;
      }
    });
  });
  return best;
}

function productGrade(place) {
  if (!place || place.verified !== true) return "UNKNOWN";
  if (place.grade === "GOOD" || place.grade === "PARTIAL" || place.grade === "POOR") return place.grade;
  if (place.grade === "EMPTY") return "POOR";
  return "UNKNOWN";
}

function assessPlaceCoverage(input = {}) {
  const place = matchPlace(input || {});
  const coverage = productGrade(place);
  const warnings = [];
  let analystNote = SAMPLE_NOTE;
  let locationStatus = "unmatched";
  if (place && place.verified !== true) {
    locationStatus = "unverified";
    warnings.push(UNVERIFIED_WARNING);
    analystNote = `${UNVERIFIED_WARNING} ${DATA_NOTE}`;
  } else if (coverage === "PARTIAL" || coverage === "POOR") {
    locationStatus = "verified";
    warnings.push(INCOMPLETE_WARNING);
    analystNote = `${INCOMPLETE_WARNING} ${DATA_NOTE}`;
  } else if (coverage === "GOOD") {
    locationStatus = "verified";
    analystNote = `${SAMPLE_NOTE} ${DATA_NOTE}`;
  } else {
    warnings.push(UNKNOWN_WARNING);
    analystNote = `${UNKNOWN_WARNING} ${DATA_NOTE}`;
  }
  return {
    coverage,
    warnings,
    analystNote,
    benchmarkId: place ? place.id : null,
    locationStatus,
    source: BENCHMARK_SOURCE,
    groundTruth: false,
  };
}

function weakestCoverage(grades) {
  const rank = { UNKNOWN: 0, POOR: 1, PARTIAL: 2, GOOD: 3 };
  const list = Array.isArray(grades) ? grades.filter((grade) => COVERAGE_GRADES.includes(grade)) : [];
  if (!list.length) return "UNKNOWN";
  return list.reduce((weakest, grade) => (rank[grade] < rank[weakest] ? grade : weakest), list[0]);
}

function comparisonConfidence(grades) {
  const list = Array.isArray(grades) ? grades : [];
  if (!list.length || list.some((grade) => grade !== "GOOD" && grade !== "PARTIAL" && grade !== "POOR")) {
    return "unknown";
  }
  if (list.some((grade) => grade === "POOR")) return "low";
  if (list.some((grade) => grade === "PARTIAL")) return "limited";
  return "supported";
}

module.exports = {
  COVERAGE_GRADES,
  INCOMPLETE_WARNING,
  UNVERIFIED_WARNING,
  UNKNOWN_WARNING,
  BENCHMARK_SOURCE,
  PLACES,
  assessPlaceCoverage,
  weakestCoverage,
  comparisonConfidence,
  placeById,
};
