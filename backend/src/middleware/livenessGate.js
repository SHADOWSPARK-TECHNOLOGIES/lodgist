/**
 * Liveness Gate Middleware
 *
 * Provides biometric liveness verification for High-Net-Worth (HNW)
 * transactions on the Lodgist Executive Tier.
 *
 * Nigerian Naira (NGN) threshold: ₦10,000,000 (Executive Tier)
 * Transactions at or above this amount trigger the liveness gate,
 * requiring the user to complete a biometric (rPPG / liveness) check.
 *
 * This middleware integrates with a placeholder biometric verification
 * service. In production, replace with an actual liveness SDK
 * (e.g., FaceTec, Onfido, or SmileIdentity).
 *
 * @module livenessGate
 */

/**
 * HNW transaction threshold in NGN.
 * Transactions >= this amount require liveness verification.
 */
const HNW_THRESHOLD_NGN = 10_000_000;

/**
 * livenessRequired - Checks if a transaction amount triggers the liveness gate.
 *
 * @param {number} amount - Transaction amount
 * @param {string} currency - Currency code (default: "NGN")
 * @returns {boolean} Whether liveness verification is required
 */
function livenessRequired(amount, currency = "NGN") {
  if (currency === "NGN" && amount >= HNW_THRESHOLD_NGN) {
    return true;
  }
  // For other currencies, use approximate USD equivalent threshold
  // ₦10M ≈ $6,000 USD (rough estimate)
  if (currency === "USD" && amount >= 6_000) {
    return true;
  }
  return false;
}

/**
 * requireLiveness - Express middleware that gates HNW transactions.
 *
 * Expected req.body shape: { amount, currency }
 * Expected req.user shape: { id, isHNW, ... } (set by requireAuth)
 *
 * If liveness is required and the user hasn't verified, returns 403
 * with instructions to complete biometric verification.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function requireLiveness(req, res, next) {
  try {
    const { amount, currency } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: "amount is required for liveness check",
      });
    }

    // Check if amount triggers the HNW threshold
    if (!livenessRequired(Number(amount), currency || "NGN")) {
      return next(); // Below threshold, no liveness needed
    }

    // HNW threshold triggered — check user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required for this transaction",
      });
    }

    // Check if user has completed HNW verification
    if (!req.user.isHNW) {
      return res.status(403).json({
        success: false,
        error: "HNW liveness verification required. Please complete biometric verification to proceed with this transaction.",
        code: "LIVENESS_REQUIRED",
        threshold: HNW_THRESHOLD_NGN,
        currency: "NGN",
      });
    }

    // User is verified HNW — proceed
    next();
  } catch (error) {
    console.error("Error in liveness gate:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during liveness check",
    });
  }
}

/**
 * verifyHNWLiveness - Placeholder function for biometric liveness verification.
 *
 * In production, integrate with:
 *   - FaceTec (3D liveness / rPPG)
 *   - Onfido (video liveness)
 *   - SmileIdentity (liveness check)
 *
 * @param {Buffer|string} biometricData - Raw biometric data or image/video buffer
 * @returns {Promise<{ verified: boolean, confidence: number }>}
 */
async function verifyHNWLiveness(biometricData) {
  // Placeholder: Replace with actual biometric SDK call
  // const result = await facetcSdk.checkLiveness(biometricData);
  // return { verified: result.live, confidence: result.confidence };

  console.log("[LivenessGate] Biometric verification placeholder — returning mock verified=true");
  return {
    verified: true,
    confidence: 0.95,
  };
}

module.exports = {
  livenessRequired,
  requireLiveness,
  verifyHNWLiveness,
  HNW_THRESHOLD_NGN,
};
