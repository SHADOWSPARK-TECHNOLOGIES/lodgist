const express = require("express");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const logger = require("../utils/logger");
const rentalCheck = require("../services/rentalCheck");
const defaultPaystack = require("../services/rentalCheckPaystack");

function createRentalChecksRouter(prisma, deps = {}) {
  const router = express.Router();
  const paystack = deps.paystack || defaultPaystack;

  router.post("/", optionalAuth, async (req, res) => {
    try {
      const created = await rentalCheck.createRentalCheck(
        prisma,
        req.body,
        req.user ? req.user.id : null
      );
      if (!created.ok) {
        return res.status(created.status || 400).json({
          success: false,
          error: "Check the rental details and try again. Photo upload is not available.",
          fields: created.errors,
        });
      }
      const check = created.check;
      logger.info("Rental check submitted", { reference: check.publicReference });
      return res.status(201).json({
        success: true,
        data: {
          publicReference: check.publicReference,
          accessToken: check.accessToken,
          status: check.status,
          paymentStatus: check.paymentStatus,
          amountNgn: rentalCheck.PRICE_NGN,
          statusPath: `/check/${check.publicReference}?token=${encodeURIComponent(check.accessToken)}`,
        },
      });
    } catch (error) {
      logger.error("Rental check create failed", { code: error.code || error.name });
      return res.status(500).json({ success: false, error: "We could not save this check." });
    }
  });

  router.get("/metrics", requireAuth, requireRole("STUDIO_ADMIN"), async (_req, res) => {
    const rows = await prisma.rentalCheck.findMany({
      select: {
        status: true,
        paymentStatus: true,
        amountKobo: true,
        createdAt: true,
        deliveredAt: true,
      },
    });
    return res.json({ success: true, data: rentalCheck.summarizeMetrics(rows) });
  });

  router.get("/", requireAuth, requireRole("STUDIO_ADMIN"), async (_req, res) => {
    const rows = await prisma.rentalCheck.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json({
      success: true,
      data: rows.map((row) => rentalCheck.customerView(row, { includeReport: false, admin: true })),
    });
  });

  router.get("/:reference", optionalAuth, async (req, res) => {
    const check = await prisma.rentalCheck.findUnique({
      where: { publicReference: String(req.params.reference || "").toUpperCase() },
    });
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const phone = typeof req.query.phone === "string" ? req.query.phone : "";
    if (!rentalCheck.canRead(check, { token, phone, user: req.user })) {
      return res.status(401).json({ success: false, error: "We cannot show that case." });
    }
    const admin = req.user && req.user.role === "STUDIO_ADMIN";
    let current = check;
    if (!admin && rentalCheck.buildReport(check) && check.status === "REPORT_READY") {
      current = await prisma.rentalCheck.update({
        where: { id: check.id },
        data: { status: "DELIVERED", deliveredAt: check.deliveredAt || new Date() },
      });
    }
    return res.json({
      success: true,
      data: rentalCheck.customerView(current, { includeReport: true, admin }),
    });
  });

  router.post("/:reference/pay", async (req, res) => {
    try {
      const result = await rentalCheck.initiatePayment(prisma, {
        reference: String(req.params.reference || "").toUpperCase(),
        token: req.body && req.body.token,
        paystack,
      });
      if (!result.ok) {
        return res.status(result.status).json({
          success: false,
          error: result.error || "Payment could not be started.",
          missing: result.missing,
        });
      }
      return res.json({
        success: true,
        data: {
          alreadyPaid: Boolean(result.alreadyPaid),
          authorizationUrl: result.authorizationUrl || null,
          paystackReference: result.paystackReference || result.check.paystackReference || null,
          status: result.check.status,
          paymentStatus: result.check.paymentStatus,
        },
      });
    } catch (error) {
      logger.error("Rental check payment start failed", { code: error.code || error.name });
      if (error.code === "PAYSTACK_NOT_CONFIGURED") {
        return res.status(503).json({ success: false, missing: ["PAYSTACK_SECRET_KEY"] });
      }
      return res.status(502).json({ success: false, error: "Paystack did not start the payment." });
    }
  });

  router.post("/:reference/confirm-payment", async (req, res) => {
    try {
      const result = await rentalCheck.confirmPayment(prisma, {
        reference: String(req.params.reference || "").toUpperCase(),
        token: req.body && req.body.token,
        paystack,
      });
      if (!result.ok) {
        return res.status(result.status).json({
          success: false,
          error: result.error || "Payment is not confirmed.",
          reason: result.reason,
          missing: result.missing,
        });
      }
      return res.json({
        success: true,
        data: rentalCheck.customerView(result.check, { includeReport: false, admin: false }),
      });
    } catch (error) {
      logger.error("Rental check payment confirm failed", { code: error.code || error.name });
      if (error.code === "PAYSTACK_NOT_CONFIGURED") {
        return res.status(503).json({ success: false, missing: ["PAYSTACK_SECRET_KEY"] });
      }
      return res.status(502).json({ success: false, error: "Paystack did not confirm the payment." });
    }
  });

  router.patch("/:reference/review", requireAuth, requireRole("STUDIO_ADMIN"), async (req, res) => {
    const check = await prisma.rentalCheck.findUnique({
      where: { publicReference: String(req.params.reference || "").toUpperCase() },
    });
    if (!check) return res.status(404).json({ success: false, error: "Case not found." });
    const parsed = rentalCheck.validateReview(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, fields: parsed.errors });
    }
    const published = rentalCheck.publishReview(check, parsed.data);
    if (!published.ok) {
      return res.status(409).json({ success: false, error: "A report can be published only after payment is confirmed." });
    }
    const updated = await prisma.rentalCheck.update({ where: { id: check.id }, data: published.data });
    logger.info("Rental check report published", { reference: updated.publicReference });
    return res.json({
      success: true,
      data: rentalCheck.customerView(updated, { includeReport: true, admin: true }),
    });
  });

  return router;
}

module.exports = createRentalChecksRouter;
