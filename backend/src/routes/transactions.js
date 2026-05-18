/**
 * transactions.js
 *
 * Escrow and Milestone Payment routes for Lodgist.
 * Implements Monnify/Moniepoint MFB framework with subaccounts,
 * 30/30/40 split, and 1.5% facilitation fee.
 *
 * @module routes/transactions
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");

// ── Constants ──────────────────────────────────────────────────────────────

const FACILITATION_FEE_RATE = 0.015; // 1.5%
const SPLIT = { tenant: 0.3, landlord: 0.3, platform: 0.4 }; // 30/30/40

// In-memory store (replace with DB in production)
const transactions = new Map();
const milestones = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────

function generateReference() {
  return `LODGIST-ESC-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function generatePaycode() {
  return crypto.randomInt(1000000000, 9999999999).toString();
}

// ── Routes ─────────────────────────────────────────────────────────────────

// POST /api/transactions/escrow
// Create a new escrow transaction
router.post("/escrow", requireAuth, (req, res) => {
  try {
    const { tenantId, landlordId, listingId, amount, currency, description } = req.body;

    if (!tenantId || !landlordId || !amount) {
      return res.status(400).json({
        error: "Missing required fields: tenantId, landlordId, amount",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    const facilitationFee = Math.round(amount * FACILITATION_FEE_RATE * 100) / 100;
    const netAmount = amount - facilitationFee;
    const tenantShare = Math.round(netAmount * SPLIT.tenant * 100) / 100;
    const landlordShare = Math.round(netAmount * SPLIT.landlord * 100) / 100;
    const platformShare = Math.round(netAmount * SPLIT.platform * 100) / 100;

    const transaction = {
      id: generateReference(),
      tenantId,
      landlordId,
      listingId: listingId || null,
      amount,
      currency: currency || "NGN",
      facilitationFee,
      splits: {
        tenant: tenantShare,
        landlord: landlordShare,
        platform: platformShare,
      },
      status: "HELD",
      description: description || "Rent escrow payment",
      paycode: generatePaycode(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    transactions.set(transaction.id, transaction);

    res.status(201).json({
      reference: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      facilitationFee: transaction.facilitationFee,
      splits: transaction.splits,
      paycode: transaction.paycode,
    });
  } catch (err) {
    console.error("Error creating escrow:", err.message);
    res.status(500).json({ error: "Failed to create escrow transaction", details: err.message });
  }
});

// POST /api/transactions/escrow/:reference/release
// Release funds from escrow
router.post("/escrow/:reference/release", requireAuth, (req, res) => {
  try {
    const tx = transactions.get(req.params.reference);

    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (tx.status !== "HELD") {
      return res.status(409).json({ error: `Cannot release funds. Current status: ${tx.status}` });
    }

    tx.status = "RELEASED";
    tx.releasedAt = new Date().toISOString();
    tx.updatedAt = new Date().toISOString();

    res.json({
      reference: tx.id,
      status: tx.status,
      releasedAt: tx.releasedAt,
      disbursements: [
        { party: "landlord", amount: tx.splits.landlord },
        { party: "platform", amount: tx.splits.platform },
      ],
    });
  } catch (err) {
    console.error("Error releasing escrow:", err.message);
    res.status(500).json({ error: "Failed to release escrow", details: err.message });
  }
});

// POST /api/transactions/escrow/:reference/refund
// Refund escrow to tenant
router.post("/escrow/:reference/refund", requireAuth, (req, res) => {
  try {
    const tx = transactions.get(req.params.reference);

    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (tx.status !== "HELD") {
      return res.status(409).json({ error: `Cannot refund. Current status: ${tx.status}` });
    }

    tx.status = "REFUNDED";
    tx.refundedAt = new Date().toISOString();
    tx.updatedAt = new Date().toISOString();

    res.json({
      reference: tx.id,
      status: tx.status,
      refundedAt: tx.refundedAt,
      refundAmount: tx.amount,
    });
  } catch (err) {
    console.error("Error refunding escrow:", err.message);
    res.status(500).json({ error: "Failed to refund escrow", details: err.message });
  }
});

// POST /api/transactions/milestone
// Create a milestone payment plan
router.post("/milestone", requireAuth, (req, res) => {
  try {
    const { transactionReference, milestones: milestoneList } = req.body;

    if (!transactionReference || !milestoneList || !Array.isArray(milestoneList)) {
      return res.status(400).json({
        error: "transactionReference and milestones array are required",
      });
    }

    const tx = transactions.get(transactionReference);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const created = milestoneList.map((m, i) => {
      const milestone = {
        id: `MS-${transactionReference}-${i + 1}`,
        transactionReference,
        description: m.description || `Milestone ${i + 1}`,
        amount: m.amount,
        dueDate: m.dueDate,
        status: "PENDING",
        completedAt: null,
        createdAt: new Date().toISOString(),
      };
      milestones.set(milestone.id, milestone);
      return milestone;
    });

    res.status(201).json({
      transactionReference,
      milestones: created,
    });
  } catch (err) {
    console.error("Error creating milestones:", err.message);
    res.status(500).json({ error: "Failed to create milestones", details: err.message });
  }
});

// POST /api/transactions/milestone/:id/complete
// Mark a milestone as completed
router.post("/milestone/:id/complete", requireAuth, (req, res) => {
  try {
    const milestone = milestones.get(req.params.id);

    if (!milestone) {
      return res.status(404).json({ error: "Milestone not found" });
    }

    if (milestone.status === "COMPLETED") {
      return res.status(409).json({ error: "Milestone already completed" });
    }

    milestone.status = "COMPLETED";
    milestone.completedAt = new Date().toISOString();

    res.json(milestone);
  } catch (err) {
    console.error("Error completing milestone:", err.message);
    res.status(500).json({ error: "Failed to complete milestone", details: err.message });
  }
});

// GET /api/transactions/:reference
// Get transaction details
router.get("/:reference", requireAuth, (req, res) => {
  const tx = transactions.get(req.params.reference);

  if (!tx) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  const txMilestones = Array.from(milestones.values()).filter(
    (m) => m.transactionReference === tx.id
  );

  res.json({ ...tx, milestones: txMilestones });
});

// GET /api/transactions
// List all transactions
router.get("/", requireAuth, (req, res) => {
  const isAdmin = req.user.role === "STUDIO_ADMIN";
  const list = Array.from(transactions.values())
    .filter((tx) => isAdmin || tx.tenantId === req.user.id || tx.landlordId === req.user.id)
    .map((tx) => ({
      reference: tx.id,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      createdAt: tx.createdAt,
    }));

  res.json(list);
});

module.exports = router;
