const express = require("express");
const { requireAuth } = require("../middleware/auth");

/**
 * Read-only escrow history. Paystack checkout was retired on 8 Oct 2026
 * (payments are arranged on WhatsApp and confirmed by staff), so the
 * initiate, hold and release endpoints are gone. EscrowTransaction rows and
 * their paystack* columns stay for historical records.
 *
 * @param {object} prisma - Prisma client instance
 * @returns {import("express").Router}
 */
function createEscrowRouter(prisma) {
  const router = express.Router();

  // ─── GET /api/escrow/:id — Fetch a single escrow transaction ──────────────────
  router.get("/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const escrowTransaction = await prisma.escrowTransaction.findUnique({
        where: { id },
        include: {
          tenant: { select: { id: true, name: true, email: true } },
          landlord: { select: { id: true, name: true, email: true } },
          listing: { select: { id: true, title: true, price: true } },
        },
      });

      if (!escrowTransaction) {
        return res.status(404).json({
          success: false,
          error: "Escrow transaction not found",
        });
      }

      // Only the tenant, the landlord or a STUDIO_ADMIN may read it (it
      // carries both parties' emails).
      const isParty =
        escrowTransaction.tenantId === req.user.id ||
        escrowTransaction.landlordId === req.user.id;
      if (!isParty && req.user.role !== "STUDIO_ADMIN") {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      res.json({ success: true, data: escrowTransaction });
    } catch (error) {
      console.error("Error fetching escrow transaction:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  // ─── GET /api/escrow — List escrow transactions (filtered by role) ────────────
  router.get("/", requireAuth, async (req, res) => {
    try {
      const { status } = req.query;
      const userId = req.user.id;

      const where = {
        OR: [
          { tenantId: userId },
          { landlordId: userId },
        ],
      };

      if (status) where.status = status;

      const transactions = await prisma.escrowTransaction.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, email: true } },
          landlord: { select: { id: true, name: true, email: true } },
          listing: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, data: transactions });
    } catch (error) {
      console.error("Error listing escrow transactions:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  });

  return router;
}

module.exports = createEscrowRouter;
