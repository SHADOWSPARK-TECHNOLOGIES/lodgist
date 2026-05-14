require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const prisma = require("../../packages/db/src/client");
const logger = require("./utils/logger");
const { globalErrorHandler } = require("./middleware/errorHandler");
const { requireAuth } = require("./middleware/auth");

const authRouter = require("./routes/auth")(prisma);
const usersRouter = require("./routes/users")(prisma);
const listingsRouter = require("./routes/listings")(prisma);
const verificationRouter = require("./routes/verification");
const aiAnalysisRouter = require("./routes/ai-analysis");
const agreementsRouter = require("./routes/agreements");
const transactionsRouter = require("./routes/transactions");
const rentRouter = require("./routes/rent");
const createEscrowRouter = require("./routes/escrow");
const escrowRouter = createEscrowRouter(prisma);
const createWhatsAppRouter = require("./routes/whatsapp");
const whatsappRouter = createWhatsAppRouter(prisma);
const reviewsRouter = require("./routes/reviews")(prisma);
const truthIndexRouter = require("./routes/truthIndex")(prisma);

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";

// ── Security Middleware ─────────────────────────────────────────────────────

// Helmet — sets secure HTTP headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

// Body parsing with size limit
app.use(express.json({ limit: "10mb" }));

// Global rate limiter — 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// Stricter rate limiter for auth routes — 20 req/min per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later." },
});

// ── HTTP Request Logging ────────────────────────────────────────────────────

app.use(morgan("combined", { stream: logger.morganStream }));

// ── Health Check ────────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  let dbStatus = "unknown";
  let dbLatency = null;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - start;
    dbStatus = "connected";
  } catch (err) {
    dbStatus = "disconnected";
    logger.error("Health check — DB unreachable", { error: err.message });
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

// ── API Routes ──────────────────────────────────────────────────────────────

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/users", usersRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/truth-index", truthIndexRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/ai-analysis", aiAnalysisRouter);
app.use("/api/agreements", agreementsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/rent", rentRouter);
app.use("/api/escrow", escrowRouter);
app.use("/api/whatsapp", whatsappRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler (handles Prisma errors, validation errors, etc.)
app.use(globalErrorHandler);

app.listen(PORT, HOST, () => {
  logger.info(`Lodgist API server running on http://${HOST}:${PORT}`);
  logger.info(`Routes:`);
  logger.info(`  GET  /api/health`);
  logger.info(`  /api/auth (register, login, passkey)`);
  logger.info(`  /api/users`);
  logger.info(`  /api/listings`);
  logger.info(`  /api/reviews`);
  logger.info(`  /api/truth-index`);
  logger.info(`  /api/verification`);
  logger.info(`  /api/ai-analysis`);
  logger.info(`  /api/agreements`);
  logger.info(`  /api/transactions`);
  logger.info(`  /api/rent`);
  logger.info(`  /api/escrow`);
  logger.info(`  /api/whatsapp`);
});

module.exports = app;
