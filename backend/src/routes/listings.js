const express = require("express");
const router = express.Router();
const { analyzeListing } = require("../services/listingScamDetection");

// GET /api/listings
router.get("/", (_req, res) => {
  res.json({ message: "Listings endpoint - GET all listings" });
});

// GET /api/listings/:id
router.get("/:id", (req, res) => {
  res.json({ message: `Listings endpoint - GET listing with id ${req.params.id}` });
});

// POST /api/listings
router.post("/", (req, res) => {
  res.status(201).json({ message: "Listings endpoint - CREATE listing", body: req.body });
});

// PUT /api/listings/:id
router.put("/:id", (req, res) => {
  res.json({ message: `Listings endpoint - UPDATE listing with id ${req.params.id}`, body: req.body });
});

// DELETE /api/listings/:id
router.delete("/:id", (req, res) => {
  res.json({ message: `Listings endpoint - DELETE listing with id ${req.params.id}` });
});

// POST /api/listings/analyze-scam
// Analyzes a listing description for potential scam indicators using AI.
// Body: { title: string, description: string }
// Returns: { risk_score: number, red_flags: string[], summary: string }
router.post("/analyze-scam", async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title && !description) {
      return res.status(400).json({
        error: "Please provide a listing title and/or description to analyze.",
      });
    }

    const result = await analyzeListing({ title, description });

    res.json(result);
  } catch (err) {
    console.error("Error analyzing listing for scams:", err);

    if (err.message && err.message.includes("OPENAI_API_KEY")) {
      return res.status(503).json({
        error:
          "Scam detection is temporarily unavailable. The AI analysis service has not been configured yet. Please contact support to enable this feature.",
      });
    }

    res.status(500).json({
      error:
        "Something went wrong while analyzing this listing. Our team has been notified. Please try again later.",
    });
  }
});

module.exports = router;
