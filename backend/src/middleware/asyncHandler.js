const logger = require("../utils/logger");

// Express 4 does not forward a rejected promise from an async route.
// On Node 20 that rejection is unhandled and the process exits.
function asyncHandler(fn) {
  return function asyncRoute(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error("Async route failed", {
        code: error && (error.code || error.name),
        message: error && error.message,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      if (res.headersSent) {
        next(error);
        return;
      }
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    });
  };
}

module.exports = asyncHandler;
