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
 *   - Verifies HMAC-SHA512 signature from x-paystack-signature header
 *   - Paystack signs the raw body with the secret key (there is no separate webhook secret)
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
const {
  isRentalPaystackReference,
} = require("../services/rentalCheck");


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify a Paystack webhook HMAC-SHA512 signature.
 *
 * Paystack signs the exact raw request bytes with PAYSTACK_SECRET_KEY
 * (HMAC-SHA512, hex digest) and sends that digest in `x-paystack-signature`.
 * There is no separate webhook secret.
 *
 * @param {string} signature - The value of x-paystack-signature header
 * @param {Buffer} rawBody - The exact request body bytes, before JSON parsing
 * @param {string} secret - The Paystack secret key
 * @returns {boolean}
 */
function verifyPaystackSignature(signature, rawBody, secret) {
  if (typeof signature !== "string" || signature.length === 0) return false;
  if (typeof secret !== "string" || secret.length === 0) return false;
  if (!Buffer.isBuffer(rawBody)) return false;

  const computed = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  const provided = Buffer.from(signature);
  const expected = Buffer.from(computed);
  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(provided, expected);
}

/**
 * Stable id for ProcessedWebhookEvent. Prefer Paystack's data.id so retries
 * match rows already stored. Fall back to event type + reference. Never use
 * a clock value — that cannot dedupe a retry.
 *
 * @param {object} event
 * @returns {string|null}
 */
function stableWebhookEventId(event) {
  const data = event && event.data;
  if (data && data.id !== undefined && data.id !== null && String(data.id) !== "") {
    return String(data.id);
  }
  if (
    data &&
    typeof event.event === "string" &&
    typeof data.reference === "string" &&
    data.reference.length > 0
  ) {
    return `${event.event}:${data.reference}`;
  }
  return null;
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
  // express.raw({ type: "application/json" }) must run on this path BEFORE
  // express.json() (see backend/src/index.js). Paystack signs those exact bytes.
  // A parsed object is not the signed payload, so it is rejected.

  router.post("/webhook", async (req, res) => {
    try {
      // 1. Require the exact raw bytes. Do not re-serialize a parsed body.
      if (!Buffer.isBuffer(req.body)) {
        console.warn("[Paystack Webhook] Rejected: raw body was not captured before JSON parsing");
        return res.status(400).json({ status: "error", message: "Raw body required" });
      }

      // 2. Verify HMAC-SHA512 before parsing or handling the event.
      //    Paystack uses PAYSTACK_SECRET_KEY. There is no separate webhook secret.
      const signatureHeader = req.headers["x-paystack-signature"];
      const signature = typeof signatureHeader === "string" ? signatureHeader : "";
      const secret = process.env.PAYSTACK_SECRET_KEY;

      if (!secret) {
        console.warn("[Paystack Webhook] Rejected: PAYSTACK_SECRET_KEY is unset");
        return res.status(401).json({ status: "error", message: "Unauthorized" });
      }

      if (!signature) {
        console.warn("[Paystack Webhook] Rejected: missing x-paystack-signature header");
        return res.status(401).json({ status: "error", message: "Missing signature" });
      }

      if (!verifyPaystackSignature(signature, req.body, secret)) {
        console.warn("[Paystack Webhook] Rejected: HMAC-SHA512 signature mismatch");
        return res.status(401).json({ status: "error", message: "Invalid signature" });
      }

      let event;
      try {
        event = JSON.parse(req.body.toString("utf8"));
      } catch {
        return res.status(400).json({ status: "error", message: "Invalid JSON payload" });
      }

      if (!event || !event.event) {
        return res.status(400).json({ status: "error", message: "Invalid webhook payload" });
      }

      // 3. Idempotency — DB-backed; survives restarts and horizontal scaling.
      //    ProcessedWebhookEvent.id has a unique constraint; concurrent duplicates from
      //    Paystack retries or multiple App Runner instances will hit P2002 and short-circuit.
      const eventId = stableWebhookEventId(event);
      if (!eventId) {
        console.warn("[Paystack Webhook] Rejected: event has no id or reference for idempotency");
        return res.status(400).json({ status: "error", message: "Event is not idempotent" });
      }

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

  if (isRentalPaystackReference(reference, data)) {
    await handleRentalChargeSuccess(prisma, data);
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

  if (isRentalPaystackReference(reference, data)) {
    await handleRentalChargeFailed(prisma, data);
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

async function handleRentalChargeSuccess(_prisma, data) {
  if (!data?.reference) return;
  console.warn("[Paystack Webhook] Rental check charge ignored. Staff confirm a transfer reference.");
}

async function handleRentalChargeFailed(_prisma, data) {
  if (!data?.reference) return;
  console.warn("[Paystack Webhook] Rental check charge.failed ignored. It does not reject a transfer reference.");
}

module.exports = createPaymentsRouter;
