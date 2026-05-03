require("dotenv").config();
const express = require("express");
const cors = require("cors");

const usersRouter = require("./routes/users");
const listingsRouter = require("./routes/listings");
const verificationRouter = require("./routes/verification");

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Lodgist API" });
});

// API Routes
app.use("/api/users", usersRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/verification", verificationRouter);

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
});

module.exports = app;
