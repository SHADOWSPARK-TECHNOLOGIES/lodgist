const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const logger = require("../utils/logger");

const ADVERTISER_SAVED_MESSAGE =
  "Thanks. A Lodgist teammate will contact you on WhatsApp to agree scope and fee. This does not verify any property. Payment never buys a verification badge.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAdvertiserLead(body) {
  const source = body && typeof body === "object" ? body : {};
  const errors = [];

  const name = typeof source.name === "string" ? source.name.trim() : "";
  if (name.length < 2 || name.length > 120) errors.push("name");

  const phone = typeof source.phone === "string" ? source.phone.trim() : "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) errors.push("phone");

  const area = typeof source.area === "string" ? source.area.trim() : "";
  if (area.length < 2 || area.length > 120) errors.push("area");

  let propertyCount = null;
  if (source.propertyCount != null && String(source.propertyCount).trim() !== "") {
    const n =
      typeof source.propertyCount === "number"
        ? source.propertyCount
        : Number(source.propertyCount);
    if (!Number.isInteger(n) || n < 1 || n > 500) errors.push("propertyCount");
    else propertyCount = n;
  }

  let notes = null;
  if (source.notes != null && String(source.notes).trim() !== "") {
    const candidate = typeof source.notes === "string" ? source.notes.trim() : "";
    if (!candidate || candidate.length > 1000) errors.push("notes");
    else notes = candidate;
  }

  let email = null;
  if (source.email != null && String(source.email).trim() !== "") {
    const candidate = typeof source.email === "string" ? source.email.trim() : "";
    if (!candidate || candidate.length > 160 || !EMAIL_RE.test(candidate)) errors.push("email");
    else email = candidate;
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: { name, phone, area, propertyCount, notes, email },
  };
}

function advertiserLeadsRouter(prisma) {
  const router = express.Router();

  // Public intake. Never creates a listing or changes verification.
  router.post("/", async (req, res) => {
    const parsed = validateAdvertiserLead(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        error: "Check name, WhatsApp phone, and area / campus.",
        fields: parsed.errors,
      });
    }

    try {
      const created = await prisma.advertiserLead.create({ data: parsed.data });
      logger.info("Advertiser lead saved", { advertiserLeadId: created.id });
      return res.status(201).json({
        success: true,
        message: ADVERTISER_SAVED_MESSAGE,
        data: { id: created.id },
      });
    } catch (error) {
      logger.error("Error saving advertiser lead", {
        code: error.code || error.name,
        message: error.message,
      });
      return res.status(500).json({
        success: false,
        error: "We could not save this request. Try again.",
      });
    }
  });

  // Staff only — phone numbers must not be public.
  router.get("/", requireAuth, requireRole("STUDIO_ADMIN"), async (_req, res) => {
    try {
      const data = await prisma.advertiserLead.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return res.json({ success: true, data });
    } catch (error) {
      logger.error("Error listing advertiser leads", {
        code: error.code || error.name,
        message: error.message,
      });
      return res.status(500).json({ success: false, error: "We could not load requests." });
    }
  });

  return router;
}

module.exports = advertiserLeadsRouter;
module.exports.validateAdvertiserLead = validateAdvertiserLead;
module.exports.ADVERTISER_SAVED_MESSAGE = ADVERTISER_SAVED_MESSAGE;
