/**
 * Payments Router — Paystack Webhook Receiver
 *
 * Handles incoming Paystack webhook events to provide reliable,
 * server-side confirmation of payment and transfer events.
 *
 * Endpoints:
 *   POST /api/payments/webhook — Paystack webhook receiver
 *
 * Security:
 *   - Verifies HMAC-SHA256 signature from x-paystack-signature header
 *   - Idempotent: stores processed webhook event IDs to prevent replay
 *
 * Events handled:
 *   - charge.success   → Update escrow status to HELD (or CONFIRMED)
 *   - charge.failed    → Update escrow status to FAILED
 *   - transfer.success → Update escrow status to RELEASED
 *   - transfer.failed  → Update escrow status to DISPUTED
 */

const express = require("express");
const crypto = require("crypto");


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify a Paystack webhook HMAC-SHA256 signature.
 *
 * Paystack signs the raw JSON body with the secret key using HMAC-SHA256
 * and sends the hex digest in the `x-paystack-signature` header.
 *
 * @param {string} signature - The value of x-paystack-signature header
 * @param {string} body - The raw JSON string of the request body
 * @param {string} secret - The Paystack secret key
 * @returns {boolean}
 */
function verifyPaystackSignature(signature, body, secret) {
  if (!signature || !body || !secret) return false;

  const computed = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  // timingSafeEqual requires both buffers to be the same length.
  // Use a constant-time comparison that handles different lengths gracefully.
  if (computed.length !== signature.length) return false;

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * Create an Express router for payment webhook endpoints.
 *
 * Accepts a `prisma` instance for testability and DI.
 *
 * @param {object} prisma - Prisma client instance
 * @returns {import("express").Router}
 */
function createPaymentsRouter(prisma) {
  const router = express.Router();

  // ─── POST /api/payments/webhook — Paystack webhook receiver ────────────────
  // NOTE: This endpoint MUST use express.raw({ type: "application/json" })
  // for HMAC verification to work (the raw body is needed to compute the HMAC).
  // This is configured at the app level OR we handle it with text/raw parsing here.
  //
  // We receive raw body via req.body (already parsed as JSON by parent middleware),
  // but for HMAC verification we need the raw string. The app-level express.json()
  // parses the body before this middleware runs. We'll reconstruct the raw string
  // by JSON-stringifying the parsed body for verification purposes.
  //
  // In production, use express.raw({ type: "application/json" }) on this route.

  router.post("/webhook", async (req, res) => {
    try {
      // 1. Decode raw body — express.raw() delivers a Buffer containing the exact bytes
      //    Paystack signed. toString() preserves those bytes for HMAC verification.
      //    The fallback to JSON.stringify is a safety net for non-raw invocations only.
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : JSON.stringify(req.body);

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return res.status(400).json({ status: "error", message: "Invalid JSON payload" });
      }

      if (!event || !event.event) {
        return res.status(400).json({ status: "error", message: "Invalid webhook payload" });
      }

      // 2. Verify HMAC signature against the exact raw bytes received
      const signature = req.headers["x-paystack-signature"];
      const secret = process.env.PAYSTACK_SECRET_KEY;

      if (!signature || !secret) {
        console.warn("[Paystack Webhook] Missing signature or secret key");
        return res.status(401).json({ status: "error", message: "Missing signature" });
      }

      const isValid = verifyPaystackSignature(signature, rawBody, secret);

      if (!isValid) {
        console.warn("[Paystack Webhook] Invalid HMAC signature — possible forgery");
        return res.status(401).json({ status: "error", message: "Invalid signature" });
      }

      // 3. Idempotency — DB-backed; survives restarts and horizontal scaling.
      //    ProcessedWebhookEvent.id has a unique constraint; concurrent duplicates from
      //    Paystack retries or multiple App Runner instances will hit P2002 and short-circuit.
      const eventId = event.data?.id ? String(event.data.id) : `${event.event}-${Date.now()}`;

      try {
        await prisma.processedWebhookEvent.create({ data: { id: eventId } });
      } catch (e) {
        if (e.code === "P2002") {
          console.log(`[Paystack Webhook] Duplicate event skipped: ${eventId}`);
          return res.json({ status: "ok", message: "Already processed" });
        }
        throw e;
      }

      // 4. Route event to appropriate handler
      const eventHandlers = {
        "charge.success": handleChargeSuccess,
        "charge.failed": handleChargeFailed,
        "transfer.success": handleTransferSuccess,
        "transfer.failed": handleTransferFailed,
      };

      const handler = eventHandlers[event.event];

      if (handler) {
        // Process asynchronously — we already returned 200
        await handler(prisma, event.data, eventId);
        console.log(`[Paystack Webhook] Processed: ${event.event} (${eventId})`);
      } else {
        console.log(`[Paystack Webhook] Unhandled event type: ${event.event}`);
      }

      // 5. Always return 200 OK quickly
      return res.json({ status: "ok" });
    } catch (error) {
      console.error("[Paystack Webhook] Error processing event:", error);
      // Still return 200 to prevent Paystack retry storm
      return res.json({ status: "ok" });
    }
  });

  return router;
}

// ─── Routing helpers ──────────────────────────────────────────────────────────

// References prefixed with LODG-ESC-BK- belong to direct Booking payments.
// All other LODG-ESC- references belong to EscrowTransaction payments.
const BOOKING_REF_PREFIX = "LODG-ESC-BK-";

function isBookingReference(reference) {
  return typeof reference === "string" && reference.startsWith(BOOKING_REF_PREFIX);
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

/**
 * Handle charge.success — payment was completed successfully.
 * Routes to Booking or EscrowTransaction handler based on reference prefix / metadata.
 */
async function handleChargeSuccess(prisma, data, eventId) {
  const reference = data?.reference;
  if (!reference) {
    console.warn("[Paystack Webhook] charge.success missing reference");
    return;
  }

  // Route by reference prefix first, then fall back to metadata type
  const bookingId = data?.metadata?.bookingId;
  if (isBookingReference(reference) || (bookingId && data?.metadata?.type === "booking_payment")) {
    await handleBookingChargeSuccess(prisma, data, reference, bookingId);
    return;
  }

  try {
    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        OR: [
          { paystackReference: reference },
          { reference: reference },
        ],
      },
    });

    if (!transaction) {
      console.warn(`[Paystack Webhook] No escrow transaction found for reference: ${reference}`);
      return;
    }

    if (transaction.status === "HELD" || transaction.status === "PENDING") {
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "HELD",
          paystackReference: reference,
          paystackAuthorizationUrl: data.authorization?.url || transaction.paystackAuthorizationUrl,
        },
      });
      console.log(`[Paystack Webhook] Escrow ${transaction.id} → HELD`);
    }
  } catch (error) {
    console.error("[Paystack Webhook] Error in charge.success (escrow) handler:", error);
  }
}

/**
 * Handle charge.success for a direct Booking payment.
 * Auto-confirms the booking — no admin verification needed.
 * verifiedBy is null (system-automated); verifiedAt is set to the event time.
 */
async function handleBookingChargeSuccess(prisma, data, reference, bookingId) {
  try {
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          ...(reference ? [{ paystackReference: reference }] : []),
          ...(bookingId  ? [{ id: bookingId }]                : []),
        ],
      },
    });

    if (!booking) {
      console.warn(`[Paystack Webhook] No booking found for reference: ${reference} / bookingId: ${bookingId}`);
      return;
    }

    if (booking.status === "CONFIRMED") {
      console.log(`[Paystack Webhook] Booking ${booking.id} already CONFIRMED — skipping`);
      return;
    }

    if (booking.status === "PENDING_VERIFICATION" || booking.status === "PENDING") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          paystackReference: reference || booking.paystackReference,
          verifiedBy: null,   // system-automated — no human verifier
          verifiedAt: new Date(),
        },
      });
      console.log(`[Paystack Webhook] Booking ${booking.id} → CONFIRMED (auto)`);
    }
  } catch (error) {
    console.error("[Paystack Webhook] Error in charge.success (booking) handler:", error);
  }
}

/**
 * Handle charge.failed — payment attempt failed.
 * Routes to Booking or EscrowTransaction handler based on reference prefix / metadata.
 */
async function handleChargeFailed(prisma, data, eventId) {
  const reference = data?.reference;
  if (!reference) {
    console.warn("[Paystack Webhook] charge.failed missing reference");
    return;
  }

  const bookingId = data?.metadata?.bookingId;
  if (isBookingReference(reference) || (bookingId && data?.metadata?.type === "booking_payment")) {
    await handleBookingChargeFailed(prisma, data, reference, bookingId);
    return;
  }

  try {
    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        OR: [
          { paystackReference: reference },
          { reference: reference },
        ],
      },
    });

    if (!transaction) {
      console.warn(`[Paystack Webhook] No escrow transaction found for reference: ${reference}`);
      return;
    }

    if (transaction.status === "HELD" || transaction.status === "PENDING") {
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED" },
      });
      console.log(`[Paystack Webhook] Escrow ${transaction.id} → FAILED`);
    }
  } catch (error) {
    console.error("[Paystack Webhook] Error in charge.failed (escrow) handler:", error);
  }
}

/**
 * Handle charge.failed for a direct Booking payment.
 * Resets status to PENDING and clears the Paystack reference so the tenant can retry.
 * The manual payment fallback (PATCH /manual-payment) remains available.
 */
async function handleBookingChargeFailed(prisma, data, reference, bookingId) {
  try {
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          ...(reference ? [{ paystackReference: reference }] : []),
          ...(bookingId  ? [{ id: bookingId }]                : []),
        ],
      },
    });

    if (!booking) {
      console.warn(`[Paystack Webhook] No booking found for reference: ${reference} / bookingId: ${bookingId}`);
      return;
    }

    if (booking.status === "PENDING_VERIFICATION" || booking.status === "PENDING") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "PENDING",
          paystackReference: null, // cleared so tenant can retry via Paystack or manual payment
        },
      });
      console.log(`[Paystack Webhook] Booking ${booking.id} → PENDING (charge failed, ref cleared)`);
    }
  } catch (error) {
    console.error("[Paystack Webhook] Error in charge.failed (booking) handler:", error);
  }
}

/**
 * Handle transfer.success — funds successfully transferred to landlord.
 * Updates escrow to RELEASED.
 */
async function handleTransferSuccess(prisma, data, eventId) {
  const reference = data?.reference;
  if (!reference) {
    console.warn("[Paystack Webhook] transfer.success missing reference");
    return;
  }

  try {
    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        OR: [
          { paystackReference: reference },
          { reference: reference },
        ],
      },
    });

    if (!transaction) {
      console.warn(`[Paystack Webhook] No escrow transaction found for reference: ${reference}`);
      return;
    }

    if (transaction.status === "HELD" || transaction.status === "PENDING") {
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "RELEASED",
          releaseDate: new Date(),
        },
      });
      console.log(`[Paystack Webhook] Escrow ${transaction.id} → RELEASED (transfer)`);
    }
  } catch (error) {
    console.error("[Paystack Webhook] Error in transfer.success handler:", error);
  }
}

/**
 * Handle transfer.failed — transfer to landlord failed.
 * Updates escrow to DISPUTED status.
 */
async function handleTransferFailed(prisma, data, eventId) {
  const reference = data?.reference;
  if (!reference) {
    console.warn("[Paystack Webhook] transfer.failed missing reference");
    return;
  }

  try {
    const transaction = await prisma.escrowTransaction.findFirst({
      where: {
        OR: [
          { paystackReference: reference },
          { reference: reference },
        ],
      },
    });

    if (!transaction) {
      console.warn(`[Paystack Webhook] No escrow transaction found for reference: ${reference}`);
      return;
    }

    if (transaction.status === "HELD" || transaction.status === "PENDING") {
      await prisma.escrowTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "DISPUTED",
        },
      });
      console.log(`[Paystack Webhook] Escrow ${transaction.id} → DISPUTED`);
    }
  } catch (error) {
    console.error("[Paystack Webhook] Error in transfer.failed handler:", error);
  }
}

module.exports = createPaymentsRouter;
