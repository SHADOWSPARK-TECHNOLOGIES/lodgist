require("dotenv").config();
const express = require("express");
const cors = require("cors");
const prisma = require("../../packages/db/src/client");

const usersRouter = require("./routes/users");
const listingsRouter = require("./routes/listings");
const verificationRouter = require("./routes/verification");
const aiAnalysisRouter = require("./routes/ai-analysis");
const agreementsRouter = require("./routes/agreements");
const transactionsRouter = require("./routes/transactions");
const rentRouter = require("./routes/rent");
const createEscrowRouter = require("./routes/escrow");
const escrowRouter = createEscrowRouter(prisma);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Lodgist API" });
});

// API Routes
app.use("/api/users", usersRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/ai-analysis", aiAnalysisRouter);
app.use("/api/agreements", agreementsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/rent", rentRouter);
app.use("/api/escrow", escrowRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Lodgist API server running on http://localhost:${PORT}`);
  console.log(`Routes:`);
  console.log(`  GET  /api/health`);
  console.log(`  /api/users`);
  console.log(`  /api/listings`);
  console.log(`  /api/verification`);
  console.log(`  /api/ai-analysis`);
  console.log(`  /api/agreements`);
  console.log(`  /api/transactions`);
  console.log(`  /api/rent`);
  console.log(`  /api/escrow`);
});

module.exports = app;
