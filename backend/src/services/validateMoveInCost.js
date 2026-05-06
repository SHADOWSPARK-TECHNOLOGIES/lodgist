/**
 * validateMoveInCost.js
 *
 * Reusable validation helper for Lodgist's total_move_in_cost metadata.
 * Checks whether a listing in category "residential" or "commercial"
 * includes valid total_move_in_cost metadata.
 *
 * Exports:
 *   validateMoveInCost(category, metadata, state)  — pure validation function
 *   validateMoveInCostMiddleware(categoryField)     — Express middleware factory
 *
 * Expected error response shape:
 *   { valid: false, errors: [{ field, message }] }
 *
 * @module validateMoveInCost
 */

// ── Assertion helpers ──────────────────────────────────────────────────────

/**
 * Assert that a value is a non-empty string.
 * @param {string} name - Field name for error messages
 * @param {unknown} value
 * @returns {string|null} Error message or null
 */
function assertString(name, value) {
  if (value === undefined || value === null) return `${name} is required`;
  if (typeof value !== "string") return `${name} must be a string`;
  if (value.trim().length === 0) return `${name} must not be empty`;
  return null;
}

/**
 * Assert that a value is a number >= 0.
 * @param {string} name - Field name for error messages
 * @param {unknown} value
 * @returns {string|null} Error message or null
 */
function assertNonNegativeNumber(name, value) {
  if (value === undefined || value === null) return `${name} is required`;
  if (typeof value !== "number") return `${name} must be a number`;
  if (value < 0) return `${name} must not be negative`;
  return null;
}

/**
 * Assert that a value is a number > 0.
 * @param {string} name - Field name for error messages
 * @param {unknown} value
 * @returns {string|null} Error message or null
 */
function assertPositiveNumber(name, value) {
  if (value === undefined || value === null) return `${name} is required`;
  if (typeof value !== "number") return `${name} must be a number`;
  if (value <= 0) return `${name} must be greater than 0`;
  return null;
}

// ── Required fields per category ───────────────────────────────────────────

const REQUIRED_FIELDS = {
  residential: ["base_rent", "agency_fee", "legal_fee", "caution_fee"],
  commercial: [
    "base_rent",
    "agency_fee",
    "legal_fee",
    "caution_fee",
    "inspection_fee",
  ],
};

// ── Validation function ────────────────────────────────────────────────────

/**
 * Validate total_move_in_cost metadata for a listing.
 *
 * @param {"residential"|"commercial"} category - The listing category
 * @param {object} metadata - The total_move_in_cost metadata object
 * @param {object} [state] - Optional state object for accumulating errors
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
function validateMoveInCost(category, metadata, state) {
  const errors = [];

  // 1. Category check
  const validCategories = Object.keys(REQUIRED_FIELDS);
  if (!validCategories.includes(category)) {
    errors.push({
      field: "category",
      message: `Unsupported category "${category}". Must be one of: ${validCategories.join(", ")}`,
    });
    // Can't validate further without knowing which fields are required
    return { valid: false, errors };
  }

  // 2. Metadata must be an object
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    errors.push({
      field: "metadata",
      message: "total_move_in_cost must be a JSON object",
    });
    return { valid: false, errors };
  }

  // 3. Validate required fields
  const required = REQUIRED_FIELDS[category];
  for (const field of required) {
    const err = assertNonNegativeNumber(field, metadata[field]);
    if (err) {
      errors.push({ field, message: err });
    }
  }

  // 4. Validate currency (optional but must be a non-empty string if present)
  if (metadata.currency !== undefined) {
    const currErr = assertString("currency", metadata.currency);
    if (currErr) {
      errors.push({ field: "currency", message: currErr });
    }
  }

  // 5. Validate total (optional but must be positive if present)
  if (metadata.total !== undefined) {
    const totalErr = assertPositiveNumber("total", metadata.total);
    if (totalErr) {
      errors.push({ field: "total", message: totalErr });
    }
  }

  // 6. Cross-field validation: total should equal sum of required fields
  if (errors.length === 0) {
    const sum = required.reduce((acc, f) => acc + (metadata[f] || 0), 0);
    if (metadata.total !== undefined && metadata.total !== sum) {
      errors.push({
        field: "total",
        message: `total (${metadata.total}) does not match sum of required fields (${sum})`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ── Express middleware ─────────────────────────────────────────────────────

/**
 * Express middleware factory that validates total_move_in_cost metadata
 * on incoming POST/PUT requests.
 *
 * @param {string} [categoryField="category"] - The request body field containing the category
 * @returns {import("express").RequestHandler}
 *
 * @example
 *   router.post("/listings", validateMoveInCostMiddleware("category"), createListing);
 */
function validateMoveInCostMiddleware(categoryField = "category") {
  return (req, res, next) => {
    const category = req.body[categoryField];
    const metadata = req.body.total_move_in_cost;

    const result = validateMoveInCost(category, metadata);

    if (!result.valid) {
      return res.status(422).json({
        error: "Validation failed for total_move_in_cost",
        details: result.errors,
      });
    }

    next();
  };
}

module.exports = {
  validateMoveInCost,
  validateMoveInCostMiddleware,
  // Expose helpers for testing
  _assertString: assertString,
  _assertNonNegativeNumber: assertNonNegativeNumber,
  _assertPositiveNumber: assertPositiveNumber,
};
