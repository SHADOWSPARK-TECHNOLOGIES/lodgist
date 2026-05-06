/**
 * ai-analysis.js
 *
 * AI Analysis routes for Lodgist.
 * Exposes 8 POST endpoints for AI-powered analysis via the TrustSafetyEngine.
 *
 * @module routes/ai-analysis
 */

const express = require("express");
const router = express.Router();
const engine = require("../services/trustSafetyEngine");

// POST /api/ai-analysis/analyze-scam
// Analyze listing text for scam indicators
router.post("/analyze-scam", async (req, res) => {
  try {
    const { title, description } = req.body;
    const result = await engine.analyzeScamText(title, description);
    res.json(result);
  } catch (err) {
    console.error("Error in analyze-scam:", err.message);
    res.status(500).json({ error: "Analysis failed", details: err.message });
  }
});

// POST /api/ai-analysis/analyze-visual
// Analyze a listing image for visual fraud indicators
router.post("/analyze-visual", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "image (base64) is required" });
    }
    const result = await engine.analyzeVisualFraud(image);
    res.json(result);
  } catch (err) {
    console.error("Error in analyze-visual:", err.message);
    res.status(500).json({ error: "Visual analysis failed", details: err.message });
  }
});

// POST /api/ai-analysis/verify-land
// Verify land document from image
router.post("/verify-land", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "image (base64) is required" });
    }
    const result = await engine.extractLandDocument(image);
    res.json(result);
  } catch (err) {
    console.error("Error in verify-land:", err.message);
    res.status(500).json({ error: "Land verification failed", details: err.message });
  }
});

// POST /api/ai-analysis/validate-coordinates
// Validate and analyze geographic coordinates
router.post("/validate-coordinates", (req, res) => {
  try {
    const { lat, lng, coord_string } = req.body;

    let coordinates;
    if (coord_string) {
      coordinates = engine.parseCoordinates(coord_string);
      if (coordinates.error) {
        return res.status(400).json({ error: coordinates.error });
      }
    } else if (lat !== undefined && lng !== undefined) {
      coordinates = { lat, lng, error: null };
    } else {
      return res.status(400).json({
        error: "Provide either lat+lng or coord_string",
      });
    }

    const { lat: clat, lng: clng } = coordinates;

    // Check flood zone
    const floodRisk = engine.checkFloodZone(clat, clng);

    // Calculate distance to known landmarks (example: Owerri center)
    const distanceToOwerri = engine.calculateDistance(clat, clng, 5.485, 7.035);

    res.json({
      coordinates: { lat: clat, lng: clng },
      in_nigeria: clat >= 4 && clat <= 14 && clng >= 2.5 && clng <= 15,
      flood_risk: floodRisk,
      distance_to_owerri_km: distanceToOwerri.distance_km,
    });
  } catch (err) {
    console.error("Error in validate-coordinates:", err.message);
    res.status(500).json({ error: "Coordinate validation failed", details: err.message });
  }
});

// POST /api/ai-analysis/assess-risk
// Perform a full consolidated risk assessment
router.post("/assess-risk", (req, res) => {
  try {
    const { aiResult, documentCheck, lat, lng, ownerData } = req.body;
    const assessment = engine.assessRisk({ aiResult, documentCheck, lat, lng, ownerData });
    res.json({
      ...assessment,
      summary: engine.summarizeRisk(assessment),
    });
  } catch (err) {
    console.error("Error in assess-risk:", err.message);
    res.status(500).json({ error: "Risk assessment failed", details: err.message });
  }
});

// POST /api/ai-analysis/chat-fraud
// Detect fraud in chat messages
router.post("/chat-fraud", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }
    const result = await engine.detectChatFraud(messages);
    res.json(result);
  } catch (err) {
    console.error("Error in chat-fraud:", err.message);
    res.status(500).json({ error: "Chat fraud detection failed", details: err.message });
  }
});

// POST /api/ai-analysis/audit-artisan
// Audit an artisan's profile
router.post("/audit-artisan", async (req, res) => {
  try {
    const { artisanData } = req.body;
    if (!artisanData) {
      return res.status(400).json({ error: "artisanData is required" });
    }
    const result = await engine.auditArtisan(artisanData);
    res.json(result);
  } catch (err) {
    console.error("Error in audit-artisan:", err.message);
    res.status(500).json({ error: "Artisan audit failed", details: err.message });
  }
});

// GET /api/ai-analysis/health
// Health check for the AI analysis service
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-analysis",
    endpoints: [
      "POST /api/ai-analysis/analyze-scam",
      "POST /api/ai-analysis/analyze-visual",
      "POST /api/ai-analysis/verify-land",
      "POST /api/ai-analysis/validate-coordinates",
      "POST /api/ai-analysis/assess-risk",
      "POST /api/ai-analysis/chat-fraud",
      "POST /api/ai-analysis/audit-artisan",
      "GET  /api/ai-analysis/health",
    ],
  });
});

module.exports = router;
