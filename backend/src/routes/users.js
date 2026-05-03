const express = require("express");
const router = express.Router();

// GET /api/users
router.get("/", (_req, res) => {
  res.json({ message: "Users endpoint - GET all users" });
});

// GET /api/users/:id
router.get("/:id", (req, res) => {
  res.json({ message: `Users endpoint - GET user with id ${req.params.id}` });
});

// POST /api/users
router.post("/", (req, res) => {
  res.status(201).json({ message: "Users endpoint - CREATE user", body: req.body });
});

// PUT /api/users/:id
router.put("/:id", (req, res) => {
  res.json({ message: `Users endpoint - UPDATE user with id ${req.params.id}`, body: req.body });
});

// DELETE /api/users/:id
router.delete("/:id", (req, res) => {
  res.json({ message: `Users endpoint - DELETE user with id ${req.params.id}` });
});

module.exports = router;
