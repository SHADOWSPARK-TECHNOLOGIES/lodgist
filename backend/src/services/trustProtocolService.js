/**
 * trustProtocolService.js
 *
 * Lodgist Trust Protocol — consolidated risk scoring and decision engine.
 * Combines inputs from Gemini AI analysis, land registry validation,
 * and geospatial checks into a single trust assessment.
 *
 * @module trustProtocolService
 */

const {
  haversineDistance,
  parseCoordinates,
  checkFloodZone,
  validateNigeriaCoordinates,
} = require("./landRegistryValidator");

// ── Scoring Weights ────────────────────────────────────────────────────────

const WEIGHTS = {
  ai_analysis: 0.35,       // 35% — AI scam/text analysis
  land_registry: 0.30,     // 30% — Land document validation
  geospatial: 0.20,        // 20% — Location validity & flood risk
  owner_verification: 0.15, // 15% — Owner identity verification
};

// ── Risk Thresholds ────────────────────────────────────────────────────────

const THRESHOLDS = {
  low: 30,      // 0–30: Low risk
  medium: 60,   // 31–60: Medium risk
  high: 80,     // 61–80: High risk
  critical: 100, // 81–100: Critical risk
};

// ── Risk Assessment ────────────────────────────────────────────────────────

/**
 * Assess flood risk for a given location.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {{ risk_level: string, risk_score: number, details: object }}
 */
function assessFloodRisk(lat, lng) {
  const floodResult = checkFloodZone(lat, lng);

  if (floodResult.in_flood_zone) {
    const zoneNames = floodResult.zones.map((z) => z.name).join(", ");
    return {
      risk_level: "high",
      risk_score: 80,
      details: {
        in_flood_zone: true,
        zones: floodResult.zones,
        warning: `Property is located in a known flood-prone area: ${zoneNames}. Exercise caution during rainy seasons.`,
      },
    };
  }

  return {
    risk_level: "low",
    risk_score: 0,
    details: {
      in_flood_zone: false,
      zones: [],
      warning: null,
    },
  };
}

/**
 * Calculate a geospatial risk score based on location validity and flood risk.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {{ score: number, details: object }}
 */
function calculateGeospatialRisk(lat, lng) {
  const details = {};
  let score = 0;

  // Check if coordinates are within Nigeria
  const boundsCheck = validateNigeriaCoordinates(lat, lng);
  if (!boundsCheck.valid) {
    score += 50;
    details.bounds_error = boundsCheck.error;
  }

  // Check flood risk
  const floodRisk = assessFloodRisk(lat, lng);
  if (floodRisk.risk_level === "high") {
    score += floodRisk.risk_score * 0.5; // 50% weight within geospatial
    details.flood_risk = floodRisk.details;
  }

  return {
    score: Math.min(100, score),
    details,
  };
}

/**
 * Calculate a land registry risk score based on document validation.
 *
 * @param {object} documentCheck - Result from document validation
 * @returns {{ score: number, details: object }}
 */
function calculateLandRegistryRisk(documentCheck) {
  if (!documentCheck) {
    return {
      score: 50, // Unknown — medium risk
      details: { warning: "No document validation data available" },
    };
  }

  const details = {};
  let score = 0;

  // Document type confidence
  if (documentCheck.type === "Certificate of Occupancy") {
    score += 0; // Best — full legal document
    details.document_quality = "high";
  } else if (documentCheck.type === "Deed of Assignment") {
    score += 20;
    details.document_quality = "medium";
  } else if (documentCheck.type === "Survey Plan") {
    score += 30;
    details.document_quality = "medium";
  } else if (documentCheck.type === "Purchase Receipt") {
    score += 50;
    details.document_quality = "low";
  } else {
    score += 70;
    details.document_quality = "unrecognized";
  }

  // Confidence adjustment
  if (documentCheck.confidence !== undefined) {
    const confidencePenalty = Math.max(0, 50 - documentCheck.confidence);
    score += confidencePenalty * 0.3;
    details.confidence = documentCheck.confidence;
  }

  return {
    score: Math.min(100, score),
    details,
  };
}

/**
 * Calculate an AI analysis risk score.
 *
 * @param {object} aiResult - Result from Gemini scam analysis
 * @returns {{ score: number, details: object }}
 */
function calculateAIAnalysisRisk(aiResult) {
  if (!aiResult) {
    return {
      score: 50, // Unknown — medium risk
      details: { warning: "No AI analysis data available" },
    };
  }

  const details = {};
  let score = 0;

  // Use the AI's risk score directly
  if (aiResult.risk_score !== undefined) {
    score += aiResult.risk_score;
    details.ai_risk_score = aiResult.risk_score;
  }

  // Add penalty for red flags
  if (aiResult.red_flags && aiResult.red_flags.length > 0) {
    const flagPenalty = Math.min(40, aiResult.red_flags.length * 10);
    score += flagPenalty;
    details.red_flag_count = aiResult.red_flags.length;
    details.red_flag_penalty = flagPenalty;
  }

  return {
    score: Math.min(100, score),
    details,
  };
}

/**
 * Calculate an owner verification risk score.
 *
 * @param {object} ownerData - Owner verification data
 * @returns {{ score: number, details: object }}
 */
function calculateOwnerRisk(ownerData) {
  if (!ownerData) {
    return {
      score: 50, // Unknown — medium risk
      details: { warning: "No owner verification data available" },
    };
  }

  const details = {};
  let score = 0;

  // Check if owner has a verified identity
  if (ownerData.verified) {
    score += 0;
    details.verified = true;
  } else {
    score += 40;
    details.verified = false;
  }

  // Check owner's truth index
  if (ownerData.truthIndex !== undefined) {
    const truthIndexPenalty = Math.max(0, 50 - ownerData.truthIndex);
    score += truthIndexPenalty * 0.5;
    details.truth_index = ownerData.truthIndex;
  }

  // Check listing history
  if (ownerData.listingCount !== undefined) {
    if (ownerData.listingCount === 0) {
      score += 20; // New user — slightly higher risk
      details.listing_history = "new";
    } else if (ownerData.listingCount > 10) {
      score -= 10; // Established user
      details.listing_history = "established";
    }
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    details,
  };
}

// ── Consolidated Assessment ────────────────────────────────────────────────

/**
 * Perform a full consolidated risk assessment.
 *
 * @param {object} inputs - All assessment inputs
 * @param {object} [inputs.aiResult] - Result from Gemini scam analysis
 * @param {object} [inputs.documentCheck] - Result from document validation
 * @param {number} [inputs.lat] - Property latitude
 * @param {number} [inputs.lng] - Property longitude
 * @param {object} [inputs.ownerData] - Owner verification data
 * @returns {{
 *   overall_score: number,
 *   risk_level: string,
 *   components: object,
 *   recommendations: string[],
 *   requires_review: boolean
 * }}
 */
function assessRisk(inputs = {}) {
  const { aiResult, documentCheck, lat, lng, ownerData } = inputs;

  // Calculate individual component scores
  const aiRisk = calculateAIAnalysisRisk(aiResult);
  const landRisk = calculateLandRegistryRisk(documentCheck);
  const geoRisk = lat !== undefined && lng !== undefined
    ? calculateGeospatialRisk(lat, lng)
    : { score: 0, details: { warning: "No location data provided" } };
  const ownerRisk = calculateOwnerRisk(ownerData);

  // Weighted overall score
  const overallScore = Math.round(
    aiRisk.score * WEIGHTS.ai_analysis +
    landRisk.score * WEIGHTS.land_registry +
    geoRisk.score * WEIGHTS.geospatial +
    ownerRisk.score * WEIGHTS.owner_verification
  );

  // Determine risk level
  let riskLevel;
  if (overallScore <= THRESHOLDS.low) {
    riskLevel = "low";
  } else if (overallScore <= THRESHOLDS.medium) {
    riskLevel = "medium";
  } else if (overallScore <= THRESHOLDS.high) {
    riskLevel = "high";
  } else {
    riskLevel = "critical";
  }

  // Generate recommendations
  const recommendations = [];
  if (overallScore > THRESHOLDS.medium) {
    recommendations.push("Request additional documentation from the owner.");
  }
  if (aiRisk.score > 50) {
    recommendations.push("Review the listing description for potential scam indicators.");
  }
  if (landRisk.score > 50) {
    recommendations.push("Verify land documents with the state land registry.");
  }
  if (geoRisk.details.flood_risk?.in_flood_zone) {
    recommendations.push("Inform the tenant about flood risk in this area.");
  }
  if (ownerRisk.score > 50) {
    recommendations.push("Request identity verification from the owner.");
  }
  if (recommendations.length === 0) {
    recommendations.push("No additional verification needed. Listing appears trustworthy.");
  }

  return {
    overall_score: overallScore,
    risk_level: riskLevel,
    components: {
      ai_analysis: { score: aiRisk.score, details: aiRisk.details },
      land_registry: { score: landRisk.score, details: landRisk.details },
      geospatial: { score: geoRisk.score, details: geoRisk.details },
      owner_verification: { score: ownerRisk.score, details: ownerRisk.details },
    },
    recommendations,
    requires_review: overallScore > THRESHOLDS.medium,
  };
}

/**
 * Get a human-readable summary of a risk assessment.
 *
 * @param {object} assessment - Result from assessRisk()
 * @returns {string}
 */
function summarizeRisk(assessment) {
  if (!assessment) return "No assessment data available.";

  const levelLabels = {
    low: "✅ Low Risk — This listing appears trustworthy.",
    medium: "⚠️ Medium Risk — Some concerns found. Proceed with caution.",
    high: "🔴 High Risk — Significant concerns. Recommend verification before proceeding.",
    critical: "🚨 Critical Risk — Strong indicators of fraud. Do not proceed without thorough verification.",
  };

  const label = levelLabels[assessment.risk_level] || "Unknown risk level.";

  return `${label}\n\nOverall Score: ${assessment.overall_score}/100\n\nRecommendations:\n${assessment.recommendations.map((r) => `  • ${r}`).join("\n")}`;
}

module.exports = {
  assessRisk,
  summarizeRisk,
  assessFloodRisk,
  calculateGeospatialRisk,
  calculateLandRegistryRisk,
  calculateAIAnalysisRisk,
  calculateOwnerRisk,
  WEIGHTS,
  THRESHOLDS,
};
