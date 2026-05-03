const { query } = require("../db");

/**
 * Calculate the Truth Index score for a user.
 *
 * Formula:
 *   score = (0.4 × activity_count) + (0.3 × verified_status) + (0.3 × avg_rating)
 *
 * The result is clamped to a 0–100 range.
 *
 * @param {number} userId
 * @returns {Promise<{ score: number, verified: boolean, details: object }>}
 */
async function calculateTrustScore(userId) {
  // Fetch verification data for the user
  const result = await query(
    `SELECT v.verified_status, v.activity_count, v.avg_rating
     FROM verifications v
     WHERE v.user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return {
      score: 0,
      verified: false,
      details: {
        activity_count: 0,
        verified_status: false,
        avg_rating: 0,
      },
    };
  }

  const { verified_status, activity_count, avg_rating } = result.rows[0];

  // Normalize activity_count: cap at 100 for scoring purposes
  const normalizedActivity = Math.min(activity_count, 100);

  // Verified status as numeric (1 if true, 0 if false)
  const verifiedNumeric = verified_status ? 1 : 0;

  // avg_rating is already 0.00–5.00; normalize to 0–100 scale
  const normalizedRating = (avg_rating / 5) * 100;

  // Apply the formula
  const score =
    0.4 * normalizedActivity +
    0.3 * (verifiedNumeric * 100) +
    0.3 * normalizedRating;

  // Clamp to 0–100
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: clampedScore,
    verified: clampedScore > 70,
    details: {
      activity_count,
      verified_status,
      avg_rating,
    },
  };
}

module.exports = { calculateTrustScore };
