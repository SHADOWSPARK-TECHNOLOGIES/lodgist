/**
 * landRegistryValidator.js
 *
 * Geospatial and document validation utilities for Lodgist's land registry.
 * Uses Haversine formula for distance calculations and validates
 * Nigerian land document formats.
 *
 * @module landRegistryValidator
 */

// ── Constants ──────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

// ── Haversine Distance ─────────────────────────────────────────────────────

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// ── Coordinate Parsing ─────────────────────────────────────────────────────

/**
 * Parse a coordinate string in various Nigerian formats.
 * Supports: "6.4531, 7.5123", "6.4531 7.5123", "[6.4531, 7.5123]"
 *
 * @param {string} coordStr - Coordinate string to parse
 * @returns {{ lat: number, lng: number } | null} Parsed coordinates or null
 */
function parseCoordinates(coordStr) {
  if (!coordStr || typeof coordStr !== "string") return null;

  // Remove brackets and whitespace
  const cleaned = coordStr.replace(/[[\]]/g, "").trim();

  // Split by comma or space
  const parts = cleaned.split(/[,\s]+/).filter(Boolean);

  if (parts.length < 2) return null;

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
}

// ── Document Validation ────────────────────────────────────────────────────

/**
 * Nigerian land document types and their expected patterns.
 */
const DOCUMENT_PATTERNS = {
  "Certificate of Occupancy": {
    patterns: [/C\s*\/?\s*O/i, /certificate\s+of\s+occupancy/i],
    description: "Issued by state government for statutory right of occupancy",
  },
  "Deed of Assignment": {
    patterns: [/deed\s+of\s+assignment/i, /assignment/i],
    description: "Transfer of ownership from one party to another",
  },
  "Survey Plan": {
    patterns: [/survey\s+plan/i, /survey/i],
    description: "Professional survey showing land boundaries and dimensions",
  },
  "Governor's Consent": {
    patterns: [/governor['’]?s?\s+consent/i, /consent/i],
    description: "Required for transfer of ownership in some states",
  },
  "Purchase Receipt": {
    patterns: [/receipt/i, /payment\s+receipt/i, /sale\s+agreement/i],
    description: "Proof of payment or sale agreement",
  },
};

/**
 * Identify the type of a Nigerian land document from its text content.
 *
 * @param {string} text - Extracted text from the document
 * @returns {{ type: string, confidence: number, description: string } | null}
 */
function identifyDocumentType(text) {
  if (!text || typeof text !== "string") return null;

  const lower = text.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const [docType, info] of Object.entries(DOCUMENT_PATTERNS)) {
    let score = 0;
    for (const pattern of info.patterns) {
      const matches = lower.match(pattern);
      if (matches) {
        score += matches.length * 25;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { type: docType, confidence: Math.min(100, score), description: info.description };
    }
  }

  return bestMatch;
}

/**
 * Validate a plot number format.
 * Nigerian plot numbers typically follow: "PLT-2024-001" or "Plot 1234" or "Block A, Plot 5"
 *
 * @param {string} plotNumber - The plot number to validate
 * @returns {{ valid: boolean, normalized: string | null, error: string | null }}
 */
function validatePlotNumber(plotNumber) {
  if (!plotNumber || typeof plotNumber !== "string") {
    return { valid: false, normalized: null, error: "Plot number is required" };
  }

  const trimmed = plotNumber.trim();

  // Pattern 1: PLT-YYYY-NNN format
  const pltPattern = /^PLT-\d{4}-\d{3,}$/i;
  if (pltPattern.test(trimmed)) {
    return { valid: true, normalized: trimmed.toUpperCase(), error: null };
  }

  // Pattern 2: "Plot NNNN" format
  const plotPattern = /^[Pp]lot\s+\d+[A-Za-z]?$/;
  if (plotPattern.test(trimmed)) {
    return { valid: true, normalized: trimmed, error: null };
  }

  // Pattern 3: "Block X, Plot Y" format
  const blockPlotPattern = /^[Bb]lock\s+\w+[,.]?\s*[Pp]lot\s+\d+$/;
  if (blockPlotPattern.test(trimmed)) {
    return { valid: true, normalized: trimmed, error: null };
  }

  return {
    valid: false,
    normalized: null,
    error: `Invalid plot number format: "${trimmed}". Expected formats: PLT-YYYY-NNN, Plot NNNN, or Block X, Plot Y`,
  };
}

// ── Geospatial Validation ──────────────────────────────────────────────────

/**
 * Known flood-prone areas in Imo State, Nigeria.
 * Each entry has a name and approximate center coordinates.
 */
const FLOOD_ZONES = [
  { name: "Nekede", lat: 5.44, lon: 7.02, radiusKm: 2 },
  { name: "Achara Layout", lat: 6.41, lon: 7.5, radiusKm: 1.5 },
  { name: "Ihiagwa", lat: 5.4, lon: 7.0, radiusKm: 1.5 },
  { name: "Eziobodo", lat: 5.38, lon: 6.98, radiusKm: 1.5 },
];

/**
 * Check if a location falls within a known flood-prone zone.
 *
 * @param {number} lat - Latitude of the location
 * @param {number} lng - Longitude of the location
 * @returns {{ in_flood_zone: boolean, zones: Array<{ name: string, distance_km: number }> }}
 */
function checkFloodZone(lat, lng) {
  const zones = [];

  for (const zone of FLOOD_ZONES) {
    const distance = haversineDistance(lat, lng, zone.lat, zone.lon);
    if (distance <= zone.radiusKm) {
      zones.push({ name: zone.name, distance_km: Math.round(distance * 100) / 100 });
    }
  }

  return {
    in_flood_zone: zones.length > 0,
    zones,
  };
}

/**
 * Validate that a set of coordinates are within Nigeria's boundaries.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {{ valid: boolean, error: string | null }}
 */
function validateNigeriaCoordinates(lat, lng) {
  // Nigeria's approximate bounding box
  const NIGERIA_BOUNDS = {
    minLat: 4.0,
    maxLat: 14.0,
    minLng: 2.5,
    maxLng: 15.0,
  };

  if (lat < NIGERIA_BOUNDS.minLat || lat > NIGERIA_BOUNDS.maxLat) {
    return {
      valid: false,
      error: `Latitude ${lat} is outside Nigeria's bounds (${NIGERIA_BOUNDS.minLat}–${NIGERIA_BOUNDS.maxLat})`,
    };
  }

  if (lng < NIGERIA_BOUNDS.minLng || lng > NIGERIA_BOUNDS.maxLng) {
    return {
      valid: false,
      error: `Longitude ${lng} is outside Nigeria's bounds (${NIGERIA_BOUNDS.minLng}–${NIGERIA_BOUNDS.maxLng})`,
    };
  }

  return { valid: true, error: null };
}

module.exports = {
  haversineDistance,
  parseCoordinates,
  identifyDocumentType,
  validatePlotNumber,
  checkFloodZone,
  validateNigeriaCoordinates,
  FLOOD_ZONES,
  DOCUMENT_PATTERNS,
};
