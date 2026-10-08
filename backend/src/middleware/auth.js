/**
 * Unified Authentication & Authorization Middleware
 *
 * Provides JWT-based authentication, role-based access control (RBAC),
 * and High-Net-Worth (HNW) gating for the Lodgist Executive Tier API.
 *
 * Replaces the previous API-key based middleware with a proper JWT system
 * that decodes the token and attaches `req.user` for downstream use.
 *
 * Usage:
 *   const { requireAuth, requireRole, requireHNW } = require("./middleware/auth");
 *   router.post("/", requireAuth, handler);
 *   router.delete("/:id", requireAuth, requireRole("STUDIO_ADMIN"), handler);
 *   router.post("/escrow", requireAuth, requireHNW, handler);
 *
 * @module auth
 */

const jwt = require("jsonwebtoken");

/**
 * Live access tokens are minted without a `type` claim (register, login,
 * passkey, and refresh). Refresh tokens set `type: "refresh"` and are signed
 * with the same JWT_SECRET, so the claim is the only separator.
 *
 * Allowlist: accept a payload only when `type` is absent. That keeps tokens
 * already in the wild working. Requiring `type: "access"` would reject them.
 * Any present type, including "refresh", is rejected.
 *
 * @param {object} decoded
 * @returns {boolean}
 */
function isUserAccessToken(decoded) {
  return Boolean(decoded) && typeof decoded === "object" && decoded.type == null;
}

/**
 * requireAuth - Verifies the Bearer JWT token from the Authorization header.
 *
 * On success, attaches decoded payload to `req.user` with shape:
 *   { id, email, name, role, isHNW, iat, exp }
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
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
    if (!isUserAccessToken(decoded)) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }

    // Attach user to request for downstream middleware/routes
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      isHNW: decoded.isHNW || false,
    };

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
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }
}

/**
 * requireRole - Factory that returns middleware enforcing a specific role.
 *
 * @param {string} role - Required role (e.g., "STUDIO_ADMIN", "LANDLORD")
 * @returns {import("express").RequestHandler}
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }
    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Requires role '${role}'`,
      });
    }
    next();
  };
}

/**
 * requireHNW - Middleware that ensures the authenticated user is verified
 * as High-Net-Worth (HNW). Used to gate high-value transactions (≥₦10M).
 *
 * Expects `req.user` to have been populated by `requireAuth` first.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function requireHNW(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }
  if (!req.user.isHNW) {
    return res.status(403).json({
      success: false,
      error: "HNW verification required for this transaction. Please complete liveness verification.",
      code: "HNW_REQUIRED",
    });
  }
  next();
}

/**
 * optionalAuth - Attaches user info if a valid token is present, but does NOT
 * block the request if no token is provided. Useful for public endpoints that
 * optionally show personalized data (e.g., listing browse).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (isUserAccessToken(decoded)) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role,
          isHNW: decoded.isHNW || false,
        };
      }
    }
  } catch {
    // Silently ignore — auth is optional
  }
  next();
}

module.exports = { requireAuth, requireRole, requireHNW, optionalAuth, isUserAccessToken };
