require("dotenv").config();
const express = require("express");
const cors = require("cors");

// ── Import the Lodgist DB client (Prisma 7 + @prisma/adapter-pg) ──────
const prisma = require("../../db/src/client");

// ── Import Fraud Check Functions ──────────────────────────────────────
const { checkDuplicateLandlordPhone, checkPriceAnomaly, performImageReverseSearch } = require("./utils/fraudChecks");

// ── Google Cloud Auth (optional) ──────────────────────────────────────
const gcpKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (gcpKeyPath) {
  try {
    const fs = require("fs");
    const stats = fs.statSync(gcpKeyPath);
    if (stats.size > 0) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = gcpKeyPath;
      console.log("✓ Google Cloud credentials loaded from", gcpKeyPath);
    } else {
      console.warn("⚠ lodgist-deploy-key.json is empty — GCP auth skipped");
    }
  } catch {
    console.warn("⚠ lodgist-deploy-key.json not found — GCP auth skipped");
  }
}

// ── Express setup ─────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ── POST /verify-land ─────────────────────────────────────────────────
// OpenAPI: Truth Sentinel — verify a land plot by plot_number and owner_name
app.post("/verify-land", async (req, res) => {
  try {
    const { plot_number, owner_name } = req.body;

    // Input validation
    if (!plot_number || typeof plot_number !== "string" || plot_number.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "plot_number is required and must be a non-empty string",
      });
    }
    if (!owner_name || typeof owner_name !== "string" || owner_name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "owner_name is required and must be a non-empty string",
      });
    }

    const normalizedPlot = plot_number.trim();
    const normalizedOwner = owner_name.trim().toLowerCase();

    // Search Listing table for matching plot_number in title or description
    const listings = await prisma.listing.findMany({
      where: {
        OR: [
          { title: { contains: normalizedPlot, mode: "insensitive" } },
          { description: { contains: normalizedPlot, mode: "insensitive" } },
        ],
      },
      include: {
        owner: true,
        fraudSignals: true,
      },
    });

    // Filter by owner name/email match
    const matches = listings.filter(
      (l) =>
        l.owner.name.toLowerCase().includes(normalizedOwner) ||
        (l.owner.email && l.owner.email.toLowerCase().includes(normalizedOwner))
    );

    const verified = matches.length > 0;

    // Build evidence summary
    const evidence = matches.map((l) => ({
      listing_id: l.id,
      title: l.title,
      price: l.price,
      status: l.status,
      owner: { id: l.owner.id, name: l.owner.name, email: l.owner.email },
      fraud_signals: l.fraudSignals.map((fs) => ({
        score: fs.score,
        reasoning: fs.reasoning,
        created_at: fs.createdAt,
      })),
    }));

    return res.json({
      success: true,
      verified,
      plot_number: normalizedPlot,
      owner_name: owner_name.trim(),
      match_count: matches.length,
      evidence,
      summary: verified
        ? `Plot "${normalizedPlot}" is linked to ${matches.length} listing(s) under "${owner_name.trim()}".`
        : `No listings found for plot "${normalizedPlot}" under "${owner_name.trim()}".`,
    });
  } catch (err) {
    console.error("Error in /verify-land:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error during land verification",
    });
  }
});

// ── POST /update-truth-index ──────────────────────────────────────────
// OpenAPI: Truth Sentinel — update a user's truthIndex score
app.post("/update-truth-index", async (req, res) => {
  try {
    const { user_id, activity_score, verification_score, rating_score, absolute_score } = req.body;

    // Input validation
    if (!user_id || typeof user_id !== "number") {
      return res.status(400).json({
        success: false,
        error: "user_id is required and must be a number",
      });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { id: user_id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User with id ${user_id} not found`,
      });
    }

    // Calculate new truth index
    let newTruthIndex;
    if (absolute_score !== undefined && typeof absolute_score === "number") {
      newTruthIndex = clamp(absolute_score, 0, 100);
    } else {
      const a = typeof activity_score === "number" ? activity_score : 50;
      const v = typeof verification_score === "number" ? verification_score : 50;
      const r = typeof rating_score === "number" ? rating_score : 50;
      // Truth Index 2.0 formula: (0.4 × activity) + (0.3 × verification) + (0.3 × rating)
      newTruthIndex = clamp(0.4 * a + 0.3 * v + 0.3 * r, 0, 100);
    }

    const previousTruthIndex = user.truthIndex;
    const delta = newTruthIndex - previousTruthIndex;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user_id },
      data: { truthIndex: newTruthIndex },
    });

    // Create audit trail
    const audit = await prisma.aIFraudSignal.create({
      data: {
        listingId: 0, // system-level audit, not tied to a listing
        score: newTruthIndex,
        reasoning: `Truth Index updated from ${previousTruthIndex.toFixed(2)} to ${newTruthIndex.toFixed(2)} (delta: ${delta.toFixed(2)})`,
        metadata: {
          type: "TRUTH_INDEX_UPDATE",
          previous_truth_index: previousTruthIndex,
          new_truth_index: newTruthIndex,
          delta,
          component_scores:
            absolute_score !== undefined
              ? { absolute_score }
              : { activity_score, verification_score, rating_score },
        },
      },
    });

    return res.json({
      success: true,
      user_id: updatedUser.id,
      user_name: updatedUser.name,
      previous_truth_index: previousTruthIndex,
      new_truth_index: newTruthIndex,
      delta,
      audited: audit.id,
    });
  } catch (err) {
    console.error("Error in /update-truth-index:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error during truth index update",
    });
  }
});

// ── GET /health ───────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "truth-sentinel",
    timestamp: new Date().toISOString(),
  });
});

// ── Start server ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Truth Sentinel running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /verify-land         — verify a land plot`);
  console.log(`  POST /update-truth-index   — update a user's truth index`);
  console.log(`  POST /api/fraud/check      — checks a listing for fraud`);
  console.log(`  GET  /health               — liveness check`);
});

// ── POST /api/fraud/check ────────────────────────────────────────────────────────
// OpenAPI: AI Fraud Buster — checks a listing for fraud and returns a risk score
app.post("/api/fraud/check", async (req, res) => {
  try {
    const { listingId } = req.body;

    // Input validation
    if (!listingId || typeof listingId !== "number") {
      return res.status(400).json({
        success: false,
        error: "listingId is required and must be a number",
      });
    }

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        owner: true, // Needed for landlord phone check
        images: true, // Needed for image reverse search
        property: true, // Needed for location for price anomaly
      },
    });

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: `Listing with id ${listingId} not found`,
      });
    }

    let fraudScore = 0;
    const fraudReasons = [];

    // Placeholder for Duplicate Landlord Phone Check
    const { score: duplicatePhoneScore, reason: duplicatePhoneReason } =
      await checkDuplicateLandlordPhone(listing);
    fraudScore += duplicatePhoneScore;
    if (duplicatePhoneReason) fraudReasons.push(duplicatePhoneReason);

    // Placeholder for Price vs. Area Median Anomaly Detection
    const { score: priceAnomalyScore, reason: priceAnomalyReason } =
      await checkPriceAnomaly(listing);
    fraudScore += priceAnomalyScore;
    if (priceAnomalyReason) fraudReasons.push(priceAnomalyReason);

    // Placeholder for Image Reverse Search via Google Vision API
    const { score: imageReverseSearchScore, reason: imageReverseSearchReason } =
      await performImageReverseSearch(listing);
    fraudScore += imageReverseSearchScore;
    if (imageReverseSearchReason) fraudReasons.push(imageReverseSearchReason);

    // Clamp fraudScore between 0 and 100
    fraudScore = clamp(fraudScore, 0, 100);

    // Save AI Fraud Signal
    await prisma.aIFraudSignal.create({
      data: {
        listingId: listing.id,
        score: fraudScore,
        reasoning: fraudReasons.join("; "),
        metadata: {
          duplicatePhoneScore,
          priceAnomalyScore,
          imageReverseSearchScore,
        },
      },
    });

    return res.json({
      success: true,
      listingId: listing.id,
      fraudScore,
      fraudReasons,
      summary: `Fraud check completed for listing ${listing.id}. Risk score: ${fraudScore.toFixed(2)}.`,
    });
  } catch (err) {
    console.error("Error in /api/fraud/check:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error during fraud check",
    });
  }
});

module.exports = app;
