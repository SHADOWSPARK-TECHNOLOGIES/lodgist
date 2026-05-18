const express = require("express");
const { requireAuth } = require("../middleware/auth");

function createBookingsRouter(prisma) {
  const router = express.Router();

  // ── PATCH /api/bookings/:id/manual-payment ────────────────────────────────
  // Tenant submits a manual payment reference (bank transfer, cash, etc.).
  // Sets status → PENDING_VERIFICATION and records the reference for admin review.
  // The booking must belong to the authenticated tenant and be in PENDING status.
  router.patch("/:id/manual-payment", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { manualPaymentRef } = req.body;

    if (!manualPaymentRef || typeof manualPaymentRef !== "string" || !manualPaymentRef.trim()) {
      return res.status(400).json({ success: false, error: "manualPaymentRef is required" });
    }

    try {
      const booking = await prisma.booking.findUnique({ where: { id } });

      if (!booking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
      }

      if (booking.tenantId !== req.user.id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      if (booking.status !== "PENDING") {
        return res.status(409).json({
          success: false,
          error: `Booking is already in status ${booking.status}`,
        });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          manualPaymentRef: manualPaymentRef.trim(),
          status: "PENDING_VERIFICATION",
        },
      });

      return res.json({ success: true, booking: updated });
    } catch (error) {
      console.error("[Bookings] Error updating manual payment:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── PATCH /api/bookings/:id/verify-payment ────────────────────────────────
  // Admin confirms or rejects a manual payment.
  // action: "approve" → CONFIRMED | "reject" → PENDING (clears ref) | "cancel" → CANCELLED
  router.patch("/:id/verify-payment", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;

    if (!["approve", "reject", "cancel"].includes(action)) {
      return res.status(400).json({ success: false, error: "action must be approve | reject | cancel" });
    }

    if (!["STUDIO_ADMIN", "LANDLORD"].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    try {
      const booking = await prisma.booking.findUnique({ where: { id } });

      if (!booking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
      }

      if (booking.status !== "PENDING_VERIFICATION") {
        return res.status(409).json({
          success: false,
          error: `Booking is not in PENDING_VERIFICATION status (current: ${booking.status})`,
        });
      }

      const statusMap = {
        approve: "CONFIRMED",
        reject: "PENDING",
        cancel: "CANCELLED",
      };

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: statusMap[action],
          manualPaymentRef: action === "reject" ? null : booking.manualPaymentRef,
        },
      });

      return res.json({ success: true, booking: updated });
    } catch (error) {
      console.error("[Bookings] Error verifying payment:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  return router;
}

module.exports = createBookingsRouter;
