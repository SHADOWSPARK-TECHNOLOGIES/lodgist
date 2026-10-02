const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const logger = require("../utils/logger");

const LEAD_SAVED_MESSAGE =
  "No verified match yet. Your request is saved. We will notify you when a checked home is available.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLead(body) {
  const source = body && typeof body === "object" ? body : {};
  const errors = [];

  const location = typeof source.location === "string" ? source.location.trim() : "";
  if (location.length < 2 || location.length > 120) errors.push("location");

  const budget = typeof source.budget === "number" ? source.budget : Number(source.budget);
  if (!Number.isFinite(budget) || budget <= 0 || budget > 1e12) errors.push("budget");

  const bedrooms = typeof source.bedrooms === "number" ? source.bedrooms : Number(source.bedrooms);
  if (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20) errors.push("bedrooms");

  const moveInTimeframe = typeof source.moveInTimeframe === "string" ? source.moveInTimeframe.trim() : "";
  if (moveInTimeframe.length < 2 || moveInTimeframe.length > 80) errors.push("moveInTimeframe");

  const phone = typeof source.phone === "string" ? source.phone.trim() : "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) errors.push("phone");

  let email = null;
  if (source.email != null && String(source.email).trim() !== "") {
    const candidate = typeof source.email === "string" ? source.email.trim() : "";
    if (!candidate || candidate.length > 160 || !EMAIL_RE.test(candidate)) errors.push("email");
    else email = candidate;
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: { location, budget, bedrooms, moveInTimeframe, phone, email },
  };
}

function leadsRouter(prisma) {
  const router = express.Router();

  // Public. A missing verified home is not an account action.
  router.post("/", async (req, res) => {
    const parsed = validateLead(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        error: "Check location, budget, bedrooms, move-in timeframe, and phone.",
        fields: parsed.errors,
      });
    }

    try {
      const created = await prisma.lead.create({ data: parsed.data });
      logger.info("Browse lead saved", { leadId: created.id });
      return res.status(201).json({
        success: true,
        message: LEAD_SAVED_MESSAGE,
        data: { id: created.id },
      });
    } catch (error) {
      logger.error("Error saving browse lead", {
        code: error.code || error.name,
        message: error.message,
      });
      return res.status(500).json({
        success: false,
        error: "We could not save this request. Try again.",
      });
    }
  });

  // Staff only. Anonymous callers cannot read saved phone numbers.
  router.get("/", requireAuth, requireRole("STUDIO_ADMIN"), async (_req, res) => {
    try {
      const data = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
      return res.json({ success: true, data });
    } catch (error) {
      logger.error("Error listing browse leads", {
        code: error.code || error.name,
        message: error.message,
      });
      return res.status(500).json({ success: false, error: "We could not load requests." });
    }
  });

  return router;
}

module.exports = leadsRouter;
module.exports.validateLead = validateLead;
module.exports.LEAD_SAVED_MESSAGE = LEAD_SAVED_MESSAGE;
