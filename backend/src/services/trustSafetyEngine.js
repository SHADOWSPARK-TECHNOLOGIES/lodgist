/**
 * trustSafetyEngine.js
 *
 * Unified Trust & Safety module for Lodgist.
 * Wires together GeminiService, LandRegistryValidator, and TrustProtocolService
 * into a single interface with input validation and graceful fallbacks.
 *
 * @module trustSafetyEngine
 */

const geminiService = require("./geminiService");
const landRegistry = require("./landRegistryValidator");
const trustProtocol = require("./trustProtocolService");

// ── Input Validation Helpers ───────────────────────────────────────────────

function assertString(value, name) {
  if (value === undefined || value === null) return `${name} is required`;
  if (typeof value !== "string") return `${name} must be a string`;
  if (value.trim().length === 0) return `${name} must not be empty`;
  return null;
}

function assertNumber(value, name) {
  if (value === undefined || value === null) return `${name} is required`;
  if (typeof value !== "number" || isNaN(value)) return `${name} must be a number`;
  return null;
}

function assertArray(value, name) {
  if (value === undefined || value === null) return `${name} is required`;
  if (!Array.isArray(value)) return `${name} must be an array`;
  return null;
}

// ── Engine Methods ─────────────────────────────────────────────────────────

/**
 * Analyze a listing for visual fraud indicators.
 * @param {string} imageBase64 - Base64-encoded image
 * @returns {Promise<object>}
 */
async function analyzeVisualFraud(imageBase64) {
  const err = assertString(imageBase64, "imageBase64");
  if (err) return { risk_score: 0, red_flags: [err], summary: "Invalid input." };
  return geminiService.analyzeVisualFraud(imageBase64);
}

/**
 * Analyze listing text for scam indicators.
 * @param {string} title - Listing title
 * @param {string} description - Listing description
 * @returns {Promise<object>}
 */
async function analyzeScamText(title, description) {
  const err1 = assertString(title, "title");
  const err2 = assertString(description, "description");
  if (err1 && err2) {
    return { risk_score: 0, red_flags: ["title and description are required"], summary: "Invalid input." };
  }
  return geminiService.analyzeScamText(title || "", description || "");
}

/**
 * Extract structured data from a land document image.
 * @param {string} imageBase64 - Base64-encoded document image
 * @returns {Promise<object>}
 */
async function extractLandDocument(imageBase64) {
  const err = assertString(imageBase64, "imageBase64");
  if (err) return { success: false, extracted: {}, raw_text: "" };
  return geminiService.extractLandDocument(imageBase64);
}

/**
 * Detect chat-based fraud patterns.
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Promise<object>}
 */
async function detectChatFraud(messages) {
  const err = assertArray(messages, "messages");
  if (err) return { is_fraud: false, risk_score: 0, red_flags: [], explanation: err };
  return geminiService.detectChatFraud(messages);
}

/**
 * Audit an artisan's profile and transaction history.
 * @param {object} artisanData
 * @returns {Promise<object>}
 */
async function auditArtisan(artisanData) {
  if (!artisanData || typeof artisanData !== "object") {
    return { rating: 0, verified: false, summary: "Invalid artisan data.", recommendations: [] };
  }
  return geminiService.auditArtisan(artisanData);
}

/**
 * Calculate Haversine distance between two coordinates.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {{ distance_km: number, error: string | null }}
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const e1 = assertNumber(lat1, "lat1");
  const e2 = assertNumber(lon1, "lon1");
  const e3 = assertNumber(lat2, "lat2");
  const e4 = assertNumber(lon2, "lon2");
  if (e1 || e2 || e3 || e4) {
    return { distance_km: 0, error: [e1, e2, e3, e4].filter(Boolean).join("; ") };
  }
  return {
    distance_km: landRegistry.haversineDistance(lat1, lon1, lat2, lon2),
    error: null,
  };
}

/**
 * Parse a coordinate string.
 * @param {string} coordStr
 * @returns {{ lat: number | null, lng: number | null, error: string | null }}
 */
function parseCoordinates(coordStr) {
  const err = assertString(coordStr, "coordStr");
  if (err) return { lat: null, lng: null, error: err };
  const result = landRegistry.parseCoordinates(coordStr);
  if (!result) return { lat: null, lng: null, error: "Could not parse coordinates" };
  return { lat: result.lat, lng: result.lng, error: null };
}

/**
 * Identify document type from text.
 * @param {string} text
 * @returns {object}
 */
function identifyDocumentType(text) {
  const err = assertString(text, "text");
  if (err) return { type: null, confidence: 0, description: err };
  const result = landRegistry.identifyDocumentType(text);
  return result || { type: null, confidence: 0, description: "Could not identify document type" };
}

/**
 * Validate a plot number format.
 * @param {string} plotNumber
 * @returns {object}
 */
function validatePlotNumber(plotNumber) {
  return landRegistry.validatePlotNumber(plotNumber);
}

/**
 * Check if coordinates fall in a flood zone.
 * @param {number} lat
 * @param {number} lng
 * @returns {object}
 */
function checkFloodZone(lat, lng) {
  const e1 = assertNumber(lat, "lat");
  const e2 = assertNumber(lng, "lng");
  if (e1 || e2) return { in_flood_zone: false, zones: [], error: [e1, e2].filter(Boolean).join("; ") };
  return landRegistry.checkFloodZone(lat, lng);
}

/**
 * Perform a full consolidated risk assessment.
 * @param {object} inputs
 * @returns {object}
 */
function assessRisk(inputs) {
  if (!inputs || typeof inputs !== "object") {
    return {
      overall_score: 50,
      risk_level: "medium",
      components: {},
      recommendations: ["Invalid assessment inputs."],
      requires_review: true,
    };
  }
  return trustProtocol.assessRisk(inputs);
}

/**
 * Get a human-readable risk summary.
 * @param {object} assessment
 * @returns {string}
 */
function summarizeRisk(assessment) {
  return trustProtocol.summarizeRisk(assessment);
}

module.exports = {
  // Gemini AI methods
  analyzeVisualFraud,
  analyzeScamText,
  extractLandDocument,
  detectChatFraud,
  auditArtisan,

  // Land Registry methods
  calculateDistance,
  parseCoordinates,
  identifyDocumentType,
  validatePlotNumber,
  checkFloodZone,

  // Trust Protocol methods
  assessRisk,
  summarizeRisk,
};
