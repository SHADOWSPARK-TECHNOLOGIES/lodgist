const express = require("express");
const { requireAuth } = require("../middleware/auth");
const logger = require("../utils/logger");

const ADMIN_ROLES = ["STUDIO_ADMIN"];

function isAdmin(user) {
  return ADMIN_ROLES.includes(user.role);
}

function createBookingsRouter(prisma) {
  const router = express.Router();

  // ── GET /api/bookings ─────────────────────────────────────────────────────
  // Admin-only: list all bookings with optional filters.
  // Query params: status, tenantId, listingId, page (default 1, page size 20)
  // This is the concierge operations queue — support staff use this to see
  // pending payment verifications and manage the pipeline.
  router.get("/", requireAuth, async (req, res) => {
    if (!isAdmin(req.user) && req.user.role !== "LANDLORD") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { status, tenantId, listingId, page: pageQuery } = req.query;
    const pageSize = 20;
    const page = Math.max(1, parseInt(pageQuery || "1", 10));
    const skip = (page - 1) * pageSize;

    const where = {};
    if (status) where.status = status;
    if (tenantId) where.tenantId = parseInt(tenantId, 10);
    if (listingId) where.listingId = parseInt(listingId, 10);
    // Landlords only see bookings on their own listings, without tenant contact details.
    const landlord = req.user.role !== "STUDIO_ADMIN";
    if (landlord) where.listing = { ownerId: req.user.id };

    try {
      const [total, bookings] = await Promise.all([
        prisma.booking.count({ where }),
        prisma.booking.findMany({
          where,
          include: {
            tenant: { select: { id: true, name: true, email: !landlord, phone: !landlord } },
            listing: { select: { id: true, title: true, price: true } },
            verifier: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
          skip,
          take: pageSize,
        }),
      ]);

      return res.json({
        success: true,
        data: landlord ? bookings.map(({ adminNotes, ...b }) => b) : bookings,
        pagination: { total, page, pageSize, pages: Math.ceil(total / pageSize) },
      });
    } catch (error) {
      logger.error("[Bookings] Error listing bookings", { error: error.message });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── GET /api/bookings/mine ────────────────────────────────────────────────
  // Tenant reads their own booking list. Must come before /:id.
  router.get("/mine", requireAuth, async (req, res) => {
    try {
      const bookings = await prisma.booking.findMany({
        where: { tenantId: req.user.id },
        include: {
          listing: { select: { id: true, title: true, price: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
      return res.json({ success: true, data: bookings });
    } catch (error) {
      logger.error("[Bookings] Error fetching tenant bookings", { error: error.message, userId: req.user.id });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── POST /api/bookings ────────────────────────────────────────────────────
  // Admin, or a LANDLORD for their own listing (tenant must be a USER who has a
  // viewing request on that listing), creates a booking on behalf of a tenant.
  // Used in the manual concierge flow: lead arrives via social/chatbot,
  // admin creates the booking, tenant then submits payment reference via
  // PATCH /manual-payment, admin verifies via PATCH /verify-payment.
  router.post("/", requireAuth, async (req, res) => {
    if (!isAdmin(req.user) && req.user.role !== "LANDLORD") {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { listingId, tenantId, startDate, endDate, totalAmount, currency, notes, sourceChannel } = req.body;
    const admin = isAdmin(req.user);

    // Landlords don't set the amount; it is computed from the listing price below.
    if (!listingId || !tenantId || !startDate || !endDate || (admin && totalAmount == null)) {
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
      if (!admin && listing.ownerId !== req.user.id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      // Sane dates for everyone (admin and landlord).
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (isNaN(start) || isNaN(end) || end <= start || start < today) {
        return res.status(400).json({ success: false, error: "Invalid dates: end must be after start, and start cannot be in the past" });
      }

      let amount = parseFloat(totalAmount);
      if (!admin) {
        // Landlords may only book a regular USER account that has already asked
        // to view this listing (a non-cancelled ViewingRequest), so they can't
        // attach bookings to arbitrary accounts.
        if (tenant.role !== "USER") {
          return res.status(400).json({ success: false, error: "Tenant must be a regular user account" });
        }
        const viewing = await prisma.viewingRequest.findFirst({
          where: {
            listingId: listing.id,
            requesterId: tenant.id,
            status: { in: ["REQUESTED", "SCHEDULED", "COMPLETED"] },
          },
          select: { id: true },
        });
        if (!viewing) {
          return res.status(403).json({ success: false, error: "Tenant has no viewing request for this listing" });
        }
        // Amount is the listing's yearly price pro-rated by days
        // (listing.price is yearly rent in the frontend).
        amount = Math.round(((listing.price * (end - start)) / (365 * 24 * 60 * 60 * 1000)) * 100) / 100;
      }

      const booking = await prisma.booking.create({
        data: {
          listingId:     listing.id,
          tenantId:      tenant.id,
          startDate:     start,
          endDate:       end,
          totalAmount:   amount,
          currency:      admin ? currency || "NGN" : listing.currency || "NGN",
          notes:         notes || null,
          sourceChannel: sourceChannel || null,
          status:        "PENDING",
        },
      });

      logger.info("[Bookings] Booking created", {
        bookingId: booking.id,
        tenantId: tenant.id,
        listingId: listing.id,
        sourceChannel: booking.sourceChannel,
        createdBy: req.user.id,
      });

      return res.status(201).json({ success: true, booking });
    } catch (error) {
      logger.error("[Bookings] Error creating booking", { error: error.message });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── GET /api/bookings/:id ─────────────────────────────────────────────────
  // Tenant reads their own booking; the listing's landlord reads it; admin reads any.
  // adminNotes are excluded from non-admin responses.
  router.get("/:id", requireAuth, async (req, res) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          listing: { select: { id: true, title: true, price: true, ownerId: true } },
          verifier: { select: { id: true, name: true } },
        },
      });
      if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

      const admin = isAdmin(req.user);
      const owner = req.user.role === "LANDLORD" && booking.listing?.ownerId === req.user.id;
      if (!admin && !owner && booking.tenantId !== req.user.id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      // Hide internal admin notes from tenants and landlords
      const response = admin ? booking : { ...booking, adminNotes: undefined };
      return res.json({ success: true, booking: response });
    } catch (error) {
      logger.error("[Bookings] Error fetching booking", { error: error.message, bookingId: req.params.id });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── PATCH /api/bookings/:id/cancel ────────────────────────────────────────
  // Tenant self-cancels their own PENDING booking.
  // Only valid from PENDING status — once payment is submitted the admin must decide.
  router.patch("/:id/cancel", requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
      const booking = await prisma.booking.findUnique({ where: { id } });

      if (!booking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
      }

      const admin = isAdmin(req.user);
      if (!admin && booking.tenantId !== req.user.id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      if (booking.status !== "PENDING") {
        return res.status(409).json({
          success: false,
          error: `Cannot cancel a booking in status ${booking.status}. Contact support.`,
        });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      logger.info("[Bookings] Booking cancelled by tenant", { bookingId: id, userId: req.user.id });
      return res.json({ success: true, booking: updated });
    } catch (error) {
      logger.error("[Bookings] Error cancelling booking", { error: error.message, bookingId: id });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── PATCH /api/bookings/:id/manual-payment ────────────────────────────────
  // Tenant OR STUDIO_ADMIN submits a manual payment reference (bank transfer, etc.).
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

      const admin = req.user.role === "STUDIO_ADMIN";
      if (!admin && booking.tenantId !== req.user.id) {
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

      logger.info("[Bookings] Manual payment reference submitted", {
        bookingId: id,
        submittedBy: req.user.id,
        isAdmin: admin,
      });

      return res.json({ success: true, booking: updated });
    } catch (error) {
      logger.error("[Bookings] Error updating manual payment", { error: error.message, bookingId: id });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── PATCH /api/bookings/:id/admin-notes ──────────────────────────────────
  // Admin updates internal notes on a booking. Not visible to tenants.
  // Useful for recording verification reasoning, rejection explanation,
  // or operational context from WhatsApp/chatbot interactions.
  router.patch("/:id/admin-notes", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { adminNotes } = req.body;

    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    if (typeof adminNotes !== "string") {
      return res.status(400).json({ success: false, error: "adminNotes must be a string" });
    }

    try {
      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

      const updated = await prisma.booking.update({
        where: { id },
        data: { adminNotes: adminNotes.trim() || null },
      });

      logger.info("[Bookings] Admin notes updated", { bookingId: id, adminId: req.user.id });
      return res.json({ success: true, booking: updated });
    } catch (error) {
      logger.error("[Bookings] Error updating admin notes", { error: error.message, bookingId: id });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── PATCH /api/bookings/:id/verify-payment ────────────────────────────────
  // Admin confirms or rejects a manual payment.
  // action: "approve" → CONFIRMED | "reject" → PENDING (clears ref) | "cancel" → CANCELLED
  // Optional adminNotes field records the reasoning for audit purposes.
  router.patch("/:id/verify-payment", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { action, adminNotes } = req.body;

    if (!["approve", "reject", "cancel"].includes(action)) {
      return res.status(400).json({ success: false, error: "action must be approve | reject | cancel" });
    }

    if (!isAdmin(req.user)) {
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
        reject:  "PENDING",
        cancel:  "CANCELLED",
      };

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status:          statusMap[action],
          // Clear manual ref on reject so tenant can resubmit; retain on approve/cancel for records
          manualPaymentRef: action === "reject" ? null : booking.manualPaymentRef,
          verifiedBy:      req.user.id,
          verifiedAt:      new Date(),
          // Record admin reasoning if provided
          ...(adminNotes !== undefined && { adminNotes: adminNotes.trim() || null }),
        },
      });

      logger.info("[Bookings] Payment verification action taken", {
        bookingId: id,
        action,
        adminId: req.user.id,
        newStatus: updated.status,
      });

      return res.json({ success: true, booking: updated });
    } catch (error) {
      logger.error("[Bookings] Error verifying payment", { error: error.message, bookingId: id });
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  return router;
}

module.exports = createBookingsRouter;
