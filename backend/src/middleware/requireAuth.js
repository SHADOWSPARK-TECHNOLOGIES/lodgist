const jwt = require("jsonwebtoken");

/**
 * Middleware to verify JWT token and attach user to request
 * Checks Authorization header: "Bearer <token>"
 */
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "Token has expired",
      });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }
    res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }
}

module.exports = requireAuth;
