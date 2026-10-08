const express = require("express");
const jwt = require("jsonwebtoken");
const { requireAuth, requireRole } = require("../middleware/auth");
const logger = require("../utils/logger");
const {
  validateIntake,
  validateReview,
  validateManualPaymentRef,
  submitManualPayment,
  reviewManualPayment,
  createRentalCheck,
  tokenMatches,
  publicStatus,
  buildReport,
  adminView,
  summarizeMetrics,
} = require("../services/rentalCheck");

const SAVED_MESSAGE =
  "Case saved. The check fee is ₦5,000. Saving this case does not pay the fee. Arrange it on WhatsApp from the case page. The Lodgist team confirms payment. This does not verify the home.";

function readToken(req) {
  const header = req.headers["x-rental-check-token"];
  if (typeof header === "string" && header.trim()) return header.trim();
  if (req.body && typeof req.body.token === "string") return req.body.token.trim();
  if (typeof req.query.token === "string") return req.query.token.trim();
  return "";
}

function optionalUser(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ") || !process.env.JWT_SECRET) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function isStudioAdmin(user) {
  return Boolean(user && user.role === "STUDIO_ADMIN");
}

function rentalChecksRouter(prisma) {
  const router = express.Router();

  router.post("/", async (req, res) => {
    const parsed = validateIntake(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        error: "Check the rental details. Screenshot upload is not available. Do not send card numbers, PINs, or OTPs.",
        fields: parsed.errors,
      });
    }
    try {
      const user = optionalUser(req);
      const userId = user && user.id ? user.id : null;
      const { check, accessToken } = await createRentalCheck(prisma, {
        ...parsed.data,
        userId,
      });
      logger.info("Rental check created", { publicReference: check.publicReference });
      return res.status(201).json({
        success: true,
        message: SAVED_MESSAGE,
        data: {
          ...publicStatus(check),
          accessToken,
        },
      });
    } catch (error) {
      logger.error("Rental check create failed", { code: error.code || error.name, message: error.message });
      return res.status(500).json({ success: false, error: "We could not save this case. Try again." });
    }
  });

  router.get("/metrics", requireAuth, requireRole("STUDIO_ADMIN"), async (_req, res) => {
    try {
      const [submitted, paidCount, delivered, paidRows, completions] = await Promise.all([
        prisma.rentalCheck.count(),
        prisma.rentalCheck.count({ where: { paymentStatus: "PAID" } }),
        prisma.rentalCheck.count({ where: { status: "DELIVERED" } }),
        prisma.rentalCheck.findMany({ where: { paymentStatus: "PAID" }, select: { amountNgn: true } }),
        prisma.rentalCheck.findMany({
          where: { reportPublishedAt: { not: null } },
          select: { createdAt: true, reportPublishedAt: true },
        }),
      ]);
      return res.json({
        success: true,
        data: summarizeMetrics({
          submitted,
          paidCount,
          delivered,
          paidAmounts: paidRows.map((row) => row.amountNgn),
          completions,
        }),
      });
    } catch (error) {
      logger.error("Rental check metrics failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not load metrics." });
    }
  });

  router.get("/", requireAuth, requireRole("STUDIO_ADMIN"), async (_req, res) => {
    try {
      const rows = await prisma.rentalCheck.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return res.json({ success: true, data: rows.map(adminView) });
    } catch (error) {
      logger.error("Rental check list failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not load cases." });
    }
  });

  router.post("/pay/verify", async (req, res) => {
    const publicReference = req.body && req.body.publicReference;
    const paystackReference = req.body && req.body.paystackReference;
    const token = readToken(req);
    if (!publicReference && !paystackReference) {
      return res.status(400).json({ success: false, error: "A case reference is required." });
    }
    try {
      const check = await prisma.rentalCheck.findFirst({
        where: publicReference ? { publicReference } : { paystackReference },
      });
      if (!check || !tokenMatches(check, token)) {
        return res.status(401).json({ success: false, error: "This case link is not valid." });
      }
      if (check.paymentStatus === "PAID") {
        return res.json({ success: true, data: publicStatus(check), alreadyPaid: true });
      }
      return res.status(409).json({
        success: false,
        error: "A Paystack return does not confirm this fee. Staff confirm a transfer reference.",
        code: "MANUAL_REVIEW_REQUIRED",
      });
    } catch (error) {
      logger.error("Rental check verify failed", { message: error.message });
      return res.status(502).json({ success: false, error: "We could not confirm payment with Paystack." });
    }
  });

  router.get("/:reference/admin", requireAuth, requireRole("STUDIO_ADMIN"), async (req, res) => {
    try {
      const check = await prisma.rentalCheck.findUnique({ where: { publicReference: req.params.reference } });
      if (!check) return res.status(404).json({ success: false, error: "Case not found." });
      return res.json({ success: true, data: adminView(check) });
    } catch (error) {
      logger.error("Rental check admin read failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not load this case." });
    }
  });

  router.get("/:reference/report", async (req, res) => {
    try {
      const check = await prisma.rentalCheck.findUnique({ where: { publicReference: req.params.reference } });
      if (!check || !tokenMatches(check, readToken(req))) {
        return res.status(401).json({ success: false, error: "This report link is not valid." });
      }
      if (check.status !== "REPORT_READY" && check.status !== "DELIVERED") {
        return res.status(409).json({
          success: false,
          error: "The report is not ready.",
          data: publicStatus(check),
        });
      }
      let current = check;
      if (check.status === "REPORT_READY") {
        current = await prisma.rentalCheck.update({
          where: { id: check.id },
          data: { status: "DELIVERED", deliveredAt: check.deliveredAt || new Date() },
        });
      }
      const report = buildReport(current);
      return res.json({ success: true, data: report });
    } catch (error) {
      logger.error("Rental check report failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not load this report." });
    }
  });

  router.post("/:reference/pay", async (req, res) => {
    const token = readToken(req);
    try {
      const check = await prisma.rentalCheck.findUnique({ where: { publicReference: req.params.reference } });
      if (!check || !tokenMatches(check, token)) {
        return res.status(401).json({ success: false, error: "This case link is not valid." });
      }
      if (check.paymentStatus === "PAID") {
        return res.json({ success: true, data: publicStatus(check), alreadyPaid: true });
      }
      if (check.status === "CANCELLED") {
        return res.status(409).json({ success: false, error: "This case is cancelled." });
      }
      return res.status(503).json({
        success: false,
        error: "Online checkout is not open. Arrange this fee on WhatsApp. The Lodgist team confirms it.",
        code: "PAYSTACK_UNAVAILABLE",
      });
    } catch (error) {
      logger.error("Rental check pay init failed", { message: error.message });
      return res.status(502).json({ success: false, error: "We could not start checkout." });
    }
  });

  router.post("/:reference/payment-reference", async (req, res) => {
    const parsed = validateManualPaymentRef(req.body);
    if (!parsed.ok) return res.status(parsed.status).json({ success: false, error: parsed.error });
    try {
      const check = await prisma.rentalCheck.findUnique({ where: { publicReference: req.params.reference } });
      const user = optionalUser(req);
      const allowed = check && (isStudioAdmin(user) || tokenMatches(check, readToken(req)));
      if (!allowed) return res.status(401).json({ success: false, error: "This case link is not valid." });
      const decision = submitManualPayment(check, parsed.ref);
      if (!decision.ok) return res.status(decision.status).json({ success: false, error: decision.error });
      const current = decision.data
        ? await prisma.rentalCheck.update({ where: { id: check.id }, data: decision.data })
        : check;
      const view = isStudioAdmin(user) ? adminView(current) : publicStatus(current);
      return res.json({
        success: true,
        data: view,
        alreadyPaid: Boolean(decision.alreadyPaid),
        alreadySubmitted: Boolean(decision.alreadySubmitted),
      });
    } catch (error) {
      logger.error("Rental check reference submit failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not save this reference." });
    }
  });

  router.patch("/:reference/payment-review", requireAuth, requireRole("STUDIO_ADMIN"), async (req, res) => {
    try {
      const check = await prisma.rentalCheck.findUnique({ where: { publicReference: req.params.reference } });
      const decision = reviewManualPayment(check, {
        action: req.body && req.body.action,
        note: req.body && req.body.note,
        reviewerId: req.user.id,
      });
      if (!decision.ok) return res.status(decision.status).json({ success: false, error: decision.error });
      const current = decision.data
        ? await prisma.rentalCheck.update({ where: { id: check.id }, data: decision.data })
        : check;
      return res.json({ success: true, data: adminView(current), alreadyPaid: Boolean(decision.alreadyPaid) });
    } catch (error) {
      logger.error("Rental check payment review failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not save this payment review." });
    }
  });

  router.patch("/:reference/review", requireAuth, requireRole("STUDIO_ADMIN"), async (req, res) => {
    try {
      const check = await prisma.rentalCheck.findUnique({ where: { publicReference: req.params.reference } });
      const parsed = validateReview(req.body, check);
      if (!parsed.ok) return res.status(parsed.status).json({ success: false, error: parsed.error });
      const updated = await prisma.rentalCheck.update({
        where: { id: check.id },
        data: { ...parsed.data, reviewedBy: req.user.id },
      });
      return res.json({ success: true, data: adminView(updated) });
    } catch (error) {
      logger.error("Rental check review failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not save this review." });
    }
  });

  router.post("/:reference/deliver", requireAuth, requireRole("STUDIO_ADMIN"), async (req, res) => {
    try {
      const check = await prisma.rentalCheck.findUnique({ where: { publicReference: req.params.reference } });
      if (!check) return res.status(404).json({ success: false, error: "Case not found." });
      if (check.status !== "REPORT_READY" && check.status !== "DELIVERED") {
        return res.status(409).json({ success: false, error: "Publish the report before marking it delivered." });
      }
      const updated = await prisma.rentalCheck.update({
        where: { id: check.id },
        data: { status: "DELIVERED", deliveredAt: check.deliveredAt || new Date() },
      });
      return res.json({ success: true, data: adminView(updated) });
    } catch (error) {
      logger.error("Rental check deliver failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not mark this report delivered." });
    }
  });

  router.get("/:reference", async (req, res) => {
    try {
      const check = await prisma.rentalCheck.findUnique({ where: { publicReference: req.params.reference } });
      if (!check) return res.status(404).json({ success: false, error: "Case not found." });
      const includePayer = tokenMatches(check, readToken(req));
      return res.json({ success: true, data: publicStatus(check, { includePayer }) });
    } catch (error) {
      logger.error("Rental check status failed", { message: error.message });
      return res.status(500).json({ success: false, error: "We could not load this case." });
    }
  });

  return router;
}

module.exports = rentalChecksRouter;
module.exports.SAVED_MESSAGE = SAVED_MESSAGE;
