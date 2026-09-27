const express = require("express");
const logger = require("../utils/logger");

module.exports = function createHealthRouter(prisma) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    let dbStatus = "unknown";
    let dbLatency = null;

    try {
      const start = Date.now();
      await prisma.user.count();
      dbLatency = Date.now() - start;
      dbStatus = "connected";
    } catch (err) {
      dbStatus = "disconnected";
      logger.error("Health check — DB unreachable", {
        code: err.code,
        error: err.message,
        cause: String(err.cause),
      });
    }

    res.json({
      status: dbStatus === "connected" ? "ok" : "degraded",
      service: "Lodgist API",
      version: "5.0.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
      },
      memory: process.memoryUsage(),
    });
  });

  return router;
};
