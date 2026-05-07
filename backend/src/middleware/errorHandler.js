/**
 * Global Error Handling Middleware
 *
 * Centralized error handler for the Lodgist Express API.
 * Handles Prisma errors, JSON parse errors, validation errors,
 * and generic errors with production-safe stack traces.
 */

/**
 * Express error-handling middleware.
 * Must have exactly 4 parameters (err, req, res, next).
 */
// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Internal Server Error";

  // ── Prisma Errors ──────────────────────────────────────────────────────────
  if (err.constructor && err.constructor.name === "PrismaClientKnownRequestError") {
    if (err.code === "P2002") {
      statusCode = 409;
      message = "Duplicate record exists";
    } else if (err.code === "P2025") {
      statusCode = 404;
      message = "Record not found";
    }
  }

  // ── JSON Parse Errors (body-parser) ────────────────────────────────────────
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON payload";
  }

  // ── Validation Errors ──────────────────────────────────────────────────────
  if (err.name === "ValidationError" || err.name === "ZodError") {
    statusCode = 400;
  }

  // ── Logging ─────────────────────────────────────────────────────────────────
  console.error(
    `[ERROR] ${req.method} ${req.originalUrl} ${statusCode} - ${err.stack || err.message}`
  );

  // ── Build Response ──────────────────────────────────────────────────────────
  const response = {
    status: "error",
    message,
  };

  // In development, include the stack trace for debugging
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  // If the error has additional details, include them
  if (err.details) {
    response.details = err.details;
  }

  res.status(statusCode).json(response);
};

module.exports = { globalErrorHandler };
