const express = require("express");
const { requireAuth } = require("../middleware/auth");
const PaystackService = require("../services/paystackService");

// Booking payment references use this sub-prefix so the webhook handler can
// route them away from EscrowTransaction lookups without touching paystackService.js.
// paystackService.applyReferencePrefix() treats anything already starting with
// "LODG-ESC-" as already-prefixed and returns it unchanged.
const BOOKING_REF_PREFIX = "LODG-ESC-BK-";

function createBookingsRouter(prisma) {
  const router = express.Router();

  // ── POST /api/bookings ────────────────────────────────────────────────────
  // Admin or LANDLORD creates a booking on behalf of a tenant.
  // Used in the manual concierge flow: lead arrives via social/chatbot,
  // admin creates the booking, tenant then submits payment reference via
  // PATCH /manual-payment, admin verifies via PATCH /verify-payment.
  router.post("/", requireAuth, async (req, res) => {
    if (!["STUDIO_ADMIN", "LANDLORD"].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { listingId, tenantId, startDate, endDate, totalAmount, currency, notes } = req.body;

    if (!listingId || !tenantId || !startDate || !endDate || totalAmount == null) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: listingId, tenantId, startDate, endDate, totalAmount",
      });
    }

    try {
      const [listing, tenant] = await Promise.all([
        prisma.listing.findUnique({ where: { id: parseInt(listingId, 10) } }),
        prisma.user.findUnique({ where: { id: parseInt(tenantId, 10) } }),
      ]);

      if (!listing) return res.status(404).json({ success: false, error: "Listing not found" });
      if (!tenant)  return res.status(404).json({ success: false, error: "Tenant not found" });

      const booking = await prisma.booking.create({
        data: {
          listingId:   listing.id,
          tenantId:    tenant.id,
          startDate:   new Date(startDate),
          endDate:     new Date(endDate),
          totalAmount: parseFloat(totalAmount),
          currency:    currency || "NGN",
          notes:       notes   || null,
          status:      "PENDING",
        },
      });

      return res.status(201).json({ success: true, booking });
    } catch (error) {
      console.error("[Bookings] Error creating booking:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── POST /api/bookings/:id/initiate-payment ──────────────────────────────
  // Tenant initiates a Paystack payment for a booking.
  // Creates a Paystack transaction, stores the reference on the booking, and
  // transitions status → PENDING_VERIFICATION.
  // On charge.success webhook: auto-confirms to CONFIRMED (no admin needed).
  // Manual payment fallback (PATCH /manual-payment) remains available when
  // a tenant pays via bank transfer instead of Paystack.
  router.post("/:id/initiate-payment", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { email, callbackUrl } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "email is required" });
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

      // Reference format: LODG-ESC-BK-{bookingId} — already has the LODG-ESC- prefix
      // so paystackService.applyReferencePrefix() returns it unchanged.
      const reference = `${BOOKING_REF_PREFIX}${id}`;

      const payment = await PaystackService.initializePayment({
        email,
        amount: booking.totalAmount,
        reference,
        idempotencyKey: `booking-payment-${id}`,
        metadata: {
          type: "booking_payment",
          bookingId: id,
          tenantId: booking.tenantId,
          listingId: booking.listingId,
        },
        ...(callbackUrl && { callbackUrl }),
      });

      await prisma.booking.update({
        where: { id },
        data: {
          paystackReference: payment.reference,
          status: "PENDING_VERIFICATION",
        },
      });

      return res.json({
        success: true,
        paystackUrl: payment.authorization_url,
        reference: payment.reference,
        bookingId: id,
      });
    } catch (error) {
      console.error("[Bookings] Error initiating Paystack payment:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── GET /api/bookings/:id ─────────────────────────────────────────────────
  // Tenant reads their own booking; STUDIO_ADMIN or LANDLORD reads any.
  router.get("/:id", requireAuth, async (req, res) => {
    try {
      const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
      if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
      const isAdmin = ["STUDIO_ADMIN", "LANDLORD"].includes(req.user.role);
      if (!isAdmin && booking.tenantId !== req.user.id)
        return res.status(403).json({ success: false, error: "Forbidden" });
      return res.json({ success: true, booking });
    } catch (error) {
      console.error("[Bookings] Error fetching booking:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── PATCH /api/bookings/:id/manual-payment ────────────────────────────────
  // Tenant OR STUDIO_ADMIN submits a manual payment reference (bank transfer, cash, etc.).
  // Admin can record the ref on behalf of a tenant in the concierge flow.
  // Sets status → PENDING_VERIFICATION and records the reference for admin review.
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

      const isAdmin = req.user.role === "STUDIO_ADMIN";
      if (!isAdmin && booking.tenantId !== req.user.id) {
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
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
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
