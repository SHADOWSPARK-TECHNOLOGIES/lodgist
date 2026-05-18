/**
 * rent.js
 *
 * RNPL (Rent Now, Pay Later) routes for Lodgist.
 * Implements Spleet White-Label API with Landlord Guarantee Layer (100% upfront)
 * and 5% facilitation fee.
 *
 * @module routes/rent
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");

// ── Constants ──────────────────────────────────────────────────────────────

const FACILITATION_FEE_RATE = 0.05; // 5%
const LANDLORD_GUARANTEE = 1.0; // 100% upfront guarantee

// In-memory store (replace with DB in production)
const rnplAgreements = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────

function generateAgreementId() {
  return `RNPL-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// ── Routes ─────────────────────────────────────────────────────────────────

// POST /api/rent/rnpl
// Create a new RNPL agreement
router.post("/rnpl", requireAuth, (req, res) => {
  try {
    const {
      tenantId,
      landlordId,
      listingId,
      monthlyRent,
      currency,
      durationMonths,
      startDate,
    } = req.body;

    if (!tenantId || !landlordId || !monthlyRent || !durationMonths) {
      return res.status(400).json({
        error: "Missing required fields: tenantId, landlordId, monthlyRent, durationMonths",
      });
    }

    if (monthlyRent <= 0) {
      return res.status(400).json({ error: "Monthly rent must be greater than 0" });
    }

    if (durationMonths < 1 || durationMonths > 12) {
      return res.status(400).json({ error: "Duration must be between 1 and 12 months" });
    }

    const totalRent = monthlyRent * durationMonths;
    const facilitationFee = Math.round(totalRent * FACILITATION_FEE_RATE * 100) / 100;
    const landlordPayout = totalRent - facilitationFee;

    // Generate payment schedule
    const paymentSchedule = [];
    for (let i = 0; i < durationMonths; i++) {
      const dueDate = new Date(startDate || Date.now());
      dueDate.setMonth(dueDate.getMonth() + i);
      paymentSchedule.push({
        month: i + 1,
        amount: monthlyRent,
        dueDate: dueDate.toISOString().split("T")[0],
        status: i === 0 ? "PENDING" : "UPCOMING",
      });
    }

    const agreement = {
      id: generateAgreementId(),
      tenantId,
      landlordId,
      listingId: listingId || null,
      monthlyRent,
      currency: currency || "NGN",
      durationMonths,
      totalRent,
      facilitationFee,
      facilitationFeeRate: FACILITATION_FEE_RATE,
      landlordPayout,
      landlordGuarantee: LANDLORD_GUARANTEE,
      status: "PENDING",
      paymentSchedule,
      startDate: startDate || new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    rnplAgreements.set(agreement.id, agreement);

    res.status(201).json({
      id: agreement.id,
      status: agreement.status,
      totalRent: agreement.totalRent,
      facilitationFee: agreement.facilitationFee,
      landlordPayout: agreement.landlordPayout,
      paymentSchedule: agreement.paymentSchedule,
    });
  } catch (err) {
    console.error("Error creating RNPL agreement:", err.message);
    res.status(500).json({ error: "Failed to create RNPL agreement", details: err.message });
  }
});

// POST /api/rent/rnpl/:id/activate
// Activate an RNPL agreement (landlord receives 100% upfront)
router.post("/rnpl/:id/activate", requireAuth, (req, res) => {
  try {
    const agreement = rnplAgreements.get(req.params.id);

    if (!agreement) {
      return res.status(404).json({ error: "RNPL agreement not found" });
    }

    if (agreement.status !== "PENDING") {
      return res.status(409).json({
        error: `Cannot activate. Current status: ${agreement.status}`,
      });
    }

    agreement.status = "ACTIVE";
    agreement.activatedAt = new Date().toISOString();
    agreement.landlordPaidAt = new Date().toISOString();

    // Mark first payment as pending for tenant
    if (agreement.paymentSchedule.length > 0) {
      agreement.paymentSchedule[0].status = "PENDING";
    }

    agreement.updatedAt = new Date().toISOString();

    res.json({
      id: agreement.id,
      status: agreement.status,
      landlordPayout: agreement.landlordPayout,
      landlordPaidAt: agreement.landlordPaidAt,
      message: "Landlord has been paid 100% upfront guarantee",
    });
  } catch (err) {
    console.error("Error activating RNPL:", err.message);
    res.status(500).json({ error: "Failed to activate RNPL agreement", details: err.message });
  }
});

// POST /api/rent/rnpl/:id/pay
// Make a monthly payment
router.post("/rnpl/:id/pay", requireAuth, (req, res) => {
  try {
    const agreement = rnplAgreements.get(req.params.id);

    if (!agreement) {
      return res.status(404).json({ error: "RNPL agreement not found" });
    }

    if (agreement.status !== "ACTIVE") {
      return res.status(409).json({
        error: `Cannot make payment. Current status: ${agreement.status}`,
      });
    }

    // Find the first pending payment
    const pendingPayment = agreement.paymentSchedule.find(
      (p) => p.status === "PENDING"
    );

    if (!pendingPayment) {
      return res.status(400).json({ error: "No pending payments found" });
    }

    pendingPayment.status = "PAID";
    pendingPayment.paidAt = new Date().toISOString();

    // Mark next month as pending if exists
    const currentIndex = agreement.paymentSchedule.indexOf(pendingPayment);
    if (currentIndex < agreement.paymentSchedule.length - 1) {
      agreement.paymentSchedule[currentIndex + 1].status = "PENDING";
    }

    // Check if all payments are completed
    const allPaid = agreement.paymentSchedule.every((p) => p.status === "PAID");
    if (allPaid) {
      agreement.status = "COMPLETED";
    }

    agreement.updatedAt = new Date().toISOString();

    res.json({
      id: agreement.id,
      status: agreement.status,
      payment: pendingPayment,
      remainingPayments: agreement.paymentSchedule.filter((p) => p.status !== "PAID").length,
    });
  } catch (err) {
    console.error("Error processing RNPL payment:", err.message);
    res.status(500).json({ error: "Failed to process payment", details: err.message });
  }
});

// GET /api/rent/rnpl/:id
// Get RNPL agreement details
router.get("/rnpl/:id", requireAuth, (req, res) => {
  const agreement = rnplAgreements.get(req.params.id);

  if (!agreement) {
    return res.status(404).json({ error: "RNPL agreement not found" });
  }

  res.json(agreement);
});

// GET /api/rent/rnpl
// List all RNPL agreements
router.get("/rnpl", requireAuth, (req, res) => {
  const isAdmin = req.user.role === "STUDIO_ADMIN";
  const list = Array.from(rnplAgreements.values())
    .filter((a) => isAdmin || a.tenantId === req.user.id || a.landlordId === req.user.id)
    .map((a) => ({
      id: a.id,
      status: a.status,
      monthlyRent: a.monthlyRent,
      durationMonths: a.durationMonths,
      totalRent: a.totalRent,
      createdAt: a.createdAt,
    }));

  res.json(list);
});

module.exports = router;
