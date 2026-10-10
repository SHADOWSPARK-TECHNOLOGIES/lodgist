const express = require("express");
const logger = require("../utils/logger");

module.exports = function createHealthRouter(prisma) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    let dbStatus = "disconnected";

    try {
      await prisma.user.count();
      dbStatus = "connected";
    } catch (err) {
      dbStatus = "disconnected";
      logger.error("Health check — DB unreachable", {
        code: err.code,
        error: err.message,
        cause: String(err.cause),
      });
    }

    // Public probe only. Memory, uptime, version, and env stay off this route.
    // HTTP status stays 200 for both outcomes: Railway's HEALTHCHECK uses
    // wget --spider on /api/health and treats any non-success as unhealthy.
    res.status(200).json({
      status: dbStatus === "connected" ? "ok" : "degraded",
      database: dbStatus,
    });
  });

  return router;
};
