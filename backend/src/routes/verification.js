const express = require("express");
const router = express.Router();
const { calculateTrustScore } = require("../services/trustService");

// GET /api/verification/status
router.get("/status", (_req, res) => {
  res.json({ message: "Verification endpoint - GET verification status" });
});

// GET /api/verification/:userId
// Returns the Truth Index score and verified status for a given user.
router.get("/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const trustData = await calculateTrustScore(userId);

    res.json({
      userId,
      trustScore: trustData.score,
      verified: trustData.verified,
      details: trustData.details,
    });
  } catch (err) {
    console.error("Error fetching verification data:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/verification/request
router.post("/request", (req, res) => {
  res.status(201).json({ message: "Verification endpoint - REQUEST verification", body: req.body });
});

// POST /api/verification/approve
router.post("/approve", (req, res) => {
  res.json({ message: "Verification endpoint - APPROVE verification", body: req.body });
});

// POST /api/verification/reject
router.post("/reject", (req, res) => {
  res.json({ message: "Verification endpoint - REJECT verification", body: req.body });
});

module.exports = router;
