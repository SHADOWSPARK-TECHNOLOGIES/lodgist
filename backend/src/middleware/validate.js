/**
 * Request Validation Middleware
 *
 * Simple validation helpers for common request payloads.
 * No external validation library required.
 */

/**
 * Validates listing creation/update payload.
 * Checks title, price, and description fields.
 */
function validateListing(req, res, next) {
  const errors = [];
  const { title, price, description } = req.body;

  if (!title || title.length < 10) errors.push("Title must be at least 10 characters");
  if (price === undefined || typeof price !== "number" || price < 0) errors.push("Invalid price");
  if (!description || description.length < 50) errors.push("Description must be at least 50 characters");

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
}

module.exports = { validateListing };
