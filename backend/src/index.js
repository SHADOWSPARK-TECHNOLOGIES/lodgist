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
const createPaymentsRouter = require("./routes/payments");
const paymentsRouter = createPaymentsRouter(prisma);
const createBookingsRouter = require("./routes/bookings");
const bookingsRouter = createBookingsRouter(prisma);
const healthRouter = require("./routes/health")(prisma);

const app = express();
// Railway sits behind one proxy; trust it so rate limiting keys on the client IP.
app.set("trust proxy", 1);
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

// ── Production startup guards ────────────────────────────────────────────────
// Crash at boot rather than silently mis-serving auth or payments in production.
if (NODE_ENV === "production") {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  if (!process.env.CORS_ORIGIN) missing.push("CORS_ORIGIN");
  const rpId = process.env.WEBAUTHN_RP_ID;
  const waOrigin = process.env.WEBAUTHN_ORIGIN;
  if (!rpId || rpId === "localhost") missing.push("WEBAUTHN_RP_ID (must be production domain, not 'localhost')");
  if (!waOrigin || waOrigin.includes("localhost")) missing.push("WEBAUTHN_ORIGIN (must be production URL, not localhost)");
  if (missing.length > 0) {
    throw new Error(`[FATAL] Missing or misconfigured production env vars:\n  ${missing.join("\n  ")}`);
  }
}

// ── Security Middleware ─────────────────────────────────────────────────────

// Helmet — sets secure HTTP headers
app.use(helmet());

// CORS — explicit origin list, fail closed in production
const corsOrigins = (() => {
  const raw = process.env.CORS_ORIGIN;

  // In development with no CORS_ORIGIN set, allow all origins (convenience)
  if (!raw && NODE_ENV === "development") {
    return "*";
  }

  // In production, CORS_ORIGIN must be explicitly set — fail closed
  if (!raw && NODE_ENV !== "development") {
    logger.warn(
      "[CORS] CORS_ORIGIN not set in production. Failing closed — no external origins allowed."
    );
    return [];
  }

  // Parse comma-separated origins, trim whitespace
  const origins = raw.split(",").map((o) => o.trim()).filter(Boolean);

  if (origins.length === 0 && NODE_ENV !== "development") {
    logger.warn(
      "[CORS] CORS_ORIGIN resolved to empty list in production. Failing closed."
    );
    return [];
  }

  return origins;
})();

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Raw body capture for webhook HMAC — must precede express.json()
// express.raw keeps req.body as a Buffer so HMAC can be computed over exact wire bytes.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use('/api/whatsapp/webhook', express.raw({ type: 'application/json' }));

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

app.use("/api/health", healthRouter);

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
app.use("/api/payments", paymentsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/whatsapp", whatsappRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler (handles Prisma errors, validation errors, etc.)
app.use(globalErrorHandler);

app.listen(PORT, HOST, () => {
  logger.info(`Lodgist API server running on http://${HOST}:${PORT} [${NODE_ENV}]`);
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
  logger.info(`  /api/payments (webhook)`);
  logger.info(`  /api/bookings (list[admin], mine, create, get, cancel, manual-payment, admin-notes, verify-payment)`);
  logger.info(`  /api/whatsapp`);

  // Warm up the Neon connection pool on startup so the first real request doesn't
  // hit an ETIMEDOUT from a cold-start suspension.
  prisma.user.count()
    .then(() => logger.info("DB warmup: connected"))
    .catch((err) => logger.warn("DB warmup failed (Neon may be cold)", { error: err.code }));
});

module.exports = app;
