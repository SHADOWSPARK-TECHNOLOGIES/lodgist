const express = require("express");
const { requireAuth } = require("../middleware/auth");
const trustProtocolService = require("../services/trustProtocolService");

module.exports = (prisma) => {
  const router = express.Router();

  // ─── GET /api/truth-index/:userId — Get user's TruthIndex score ───────────
  router.get("/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          truthIndex: true,
          isVerified: true,
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Also fetch the latest TruthIndexScore record for breakdown
      const latestScore = await prisma.truthIndexScore.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      res.json({
        success: true,
        data: {
          userId: user.id,
          name: user.name,
          truthIndex: user.truthIndex,
          isVerified: user.isVerified,
          breakdown: latestScore
            ? {
                score: latestScore.score,
                activityScore: latestScore.activityScore,
                verificationScore: latestScore.verificationScore,
                ratingScore: latestScore.ratingScore,
                calculatedAt: latestScore.createdAt,
              }
            : null,
        },
      });
    } catch (error) {
      console.error("Error fetching TruthIndex:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ─── POST /api/truth-index/recalculate — Recalculate user's TruthIndex ────
  // Protected: only the user themselves or STUDIO_ADMIN can recalculate
  router.post("/recalculate", requireAuth, async (req, res) => {
    try {
      const { userId } = req.body;
      const requestingUserId = req.user.id;
      const requestingUserRole = req.user.role;

      // Determine which user to recalculate for
      const targetUserId = userId || requestingUserId;

      // Permission check: only self or STUDIO_ADMIN
      if (targetUserId !== requestingUserId && requestingUserRole !== "STUDIO_ADMIN") {
        return res.status(403).json({
          success: false,
          error: "You can only recalculate your own TruthIndex",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
          reviews: true,
          profile: true,
          listings: {
            include: {
              fraudSignals: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Delegate scoring to the existing trustProtocolService
      // The manifest expects trustProtocol.calculateScore(), but the actual
      // service exposes assessRisk(). We adapt by building the inputs and
      // converting the risk assessment into a TruthIndex score.
      let assessment;
      try {
        assessment = trustProtocolService.assessRisk({
          user,
          reviews: user.reviews,
          listings: user.listings,
          profile: user.profile,
        });
      } catch (serviceError) {
        console.error("Trust protocol service error, using fallback:", serviceError.message);
        // Fallback scoring if assessRisk fails
        assessment = calculateFallbackScore(user);
      }

      // Convert risk assessment score to TruthIndex (0-100)
      // trustProtocol returns 0-100 where higher = safer; TruthIndex is same scale
      const truthScore = assessment.overall_score ?? assessment.score ?? 50;
      const clampedScore = Math.max(0, Math.min(100, truthScore));

      // Save to TruthIndexScore history
      const scoreRecord = await prisma.truthIndexScore.create({
        data: {
          userId: targetUserId,
          score: clampedScore,
          activityScore: assessment.components?.owner_verification?.score ?? null,
          verificationScore: assessment.components?.land_registry?.score ?? null,
          ratingScore: assessment.components?.ai_analysis?.score ?? null,
          metadata: {
            riskLevel: assessment.risk_level,
            recommendations: assessment.recommendations,
            componentScores: assessment.components,
          },
        },
      });

      // Update the user's truthIndex field
      await prisma.user.update({
        where: { id: targetUserId },
        data: { truthIndex: clampedScore },
      });

      res.json({
        success: true,
        message: "TruthIndex recalculated successfully",
        data: {
          truthIndex: clampedScore,
          riskLevel: assessment.risk_level,
          breakdown: {
            score: scoreRecord.score,
            activityScore: scoreRecord.activityScore,
            verificationScore: scoreRecord.verificationScore,
            ratingScore: scoreRecord.ratingScore,
          },
          recommendations: assessment.recommendations || [],
          requiresReview: assessment.requires_review || false,
          calculatedAt: scoreRecord.createdAt,
        },
      });
    } catch (error) {
      console.error("Error recalculating TruthIndex:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ─── GET /api/truth-index/:userId/history — Get TruthIndex score history ──
  router.get("/:userId/history", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: "Invalid user ID" });
      }

      const scores = await prisma.truthIndexScore.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30, // Last 30 score records
        select: {
          score: true,
          activityScore: true,
          verificationScore: true,
          ratingScore: true,
          createdAt: true,
        },
      });

      res.json({
        success: true,
        data: scores,
      });
    } catch (error) {
      console.error("Error fetching TruthIndex history:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  return router;
};

/**
 * Fallback scoring function used when trustProtocolService.assessRisk()
 * is unavailable or throws an error.
 *
 * @param {object} user - Prisma user object with included relations
 * @returns {object} Scored assessment
 */
function calculateFallbackScore(user) {
  let score = 50; // Start at neutral

  // Increase score based on profile completeness
  if (user.profile) {
    if (user.profile.idVerified) score += 15;
    if (user.profile.bio) score += 3;
    if (user.profile.state) score += 2;
  }

  // Increase score for verified accounts
  if (user.isVerified) score += 10;

  // Decrease or increase based on review sentiment
  if (user.reviews && user.reviews.length > 0) {
    const avgRating = user.reviews.reduce((sum, r) => sum + r.rating, 0) / user.reviews.length;
    score += (avgRating - 3) * 5; // +/-10 based on average rating
  }

  // Fraud signals decrease score
  if (user.listings) {
    const hasFraud = user.listings.some((l) =>
      l.fraudSignals?.some((fs) => fs.score > 0.7)
    );
    if (hasFraud) score -= 25;
  }

  const clampedScore = Math.max(0, Math.min(100, score));

  const riskLevel =
    clampedScore >= 80 ? "LOW" :
    clampedScore >= 50 ? "MEDIUM" :
    "HIGH";

  return {
    overall_score: clampedScore,
    score: clampedScore,
    risk_level: riskLevel,
    requires_review: clampedScore < 40,
    recommendations:
      clampedScore < 40
        ? ["Complete profile verification", "Resolve any fraud flags on listings"]
        : clampedScore < 70
          ? ["Complete your profile for a higher score"]
          : [],
    components: {
      owner_verification: { score: user.isVerified ? 85 : 30 },
      land_registry: { score: user.profile?.idVerified ? 80 : 20 },
      ai_analysis: { score: 50 },
    },
  };
}
