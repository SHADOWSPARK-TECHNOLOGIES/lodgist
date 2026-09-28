const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireLiveness } = require("../middleware/livenessGate");

// ponytail: hardcoded 5% platform fee; move to env/config only if the rate changes
const COMMISSION_RATE = 0.05;

/**
 * Create an Express router for escrow endpoints.
 * Accepts a `prisma` instance and a `paystackService` for testability.
 *
 * @param {object} prisma - Prisma client instance
 * @param {object} [paystackService] - Paystack service (defaults to real implementation)
 * @returns {import("express").Router}
 */
function createEscrowRouter(prisma, paystackService) {
  const PaystackService = paystackService || require("../services/paystackService");
  const router = express.Router();

  // ─── POST /api/escrow/initiate — Tenant initiates escrow payment ──────────────
  // Protected by requireAuth + requireLiveness for HNW transactions
  router.post("/initiate", requireAuth, requireLiveness, async (req, res) => {
    try {
      const { landlordId, listingId, amount, currency, description, tenantEmail } = req.body;

      // tenantId always from authenticated user
      const tenantId = req.user.id;

      // Input validation
      if (!landlordId || !amount || !currency) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: landlordId, amount, currency",
        });
      }

      if (!tenantEmail) {
        return res.status(400).json({
          success: false,
          error: "tenantEmail is required for Paystack payment",
        });
      }

      // 1. Create a pending EscrowTransaction in Prisma with prefixed reference
      const escrowTransaction = await prisma.escrowTransaction.create({
        data: {
          tenantId,
          landlordId,
          listingId: listingId || null,
          amount,
          currency,
          description: description || "Rent escrow payment",
          status: "PENDING",
          reference: `LODG-ESC-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        },
      });

      // 2. Initiate payment with Paystack (idempotency key = escrowTransaction.id)
      const paymentDetails = await PaystackService.initializePayment({
        email: tenantEmail,
        amount, // PaystackService.toKobo() is called internally
        reference: escrowTransaction.reference,
        idempotencyKey: `escrow-init-${escrowTransaction.id}`,
        metadata: {
          escrowTransactionId: escrowTransaction.id,
          tenantId,
          landlordId,
          listingId,
        },
      });

      // 3. Update the escrow transaction with Paystack's authorization URL and reference
      await prisma.escrowTransaction.update({
        where: { id: escrowTransaction.id },
        data: {
          paystackAuthorizationUrl: paymentDetails.authorization_url,
          paystackReference: paymentDetails.reference,
        },
      });

      res.json({
        success: true,
        message: "Escrow initiation successful. Redirect tenant to payment URL.",
        escrowTransactionId: escrowTransaction.id,
        paymentAuthorizationUrl: paymentDetails.authorization_url,
        paystackReference: paymentDetails.reference,
      });
    } catch (error) {
      console.error("Error initiating escrow payment:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });

  // ─── POST /api/escrow/hold — Confirm payment received, funds held in escrow ───
  router.post("/hold", requireAuth, async (req, res) => {
    try {
      const { reference } = req.body;

      if (!reference) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: reference",
        });
      }

      // 1. Verify the payment with Paystack
      const verification = await PaystackService.verifyPayment(reference);

      if (verification.status !== "success") {
        return res.status(400).json({
          success: false,
          error: `Payment not successful. Paystack status: ${verification.status}`,
        });
      }

      // 2. Find the escrow transaction by reference (try both original and paystack reference)
      const escrowTransaction = await prisma.escrowTransaction.findFirst({
        where: {
          OR: [
            { reference },
            { paystackReference: reference },
          ],
        },
      });

      if (!escrowTransaction) {
        return res.status(404).json({
          success: false,
          error: "Escrow transaction not found",
        });
      }

      if (escrowTransaction.status !== "PENDING" && escrowTransaction.status !== "HELD") {
        return res.status(409).json({
          success: false,
          error: `Escrow transaction is already ${escrowTransaction.status.toLowerCase()}`,
        });
      }

      // 3. Update the transaction status
      await prisma.escrowTransaction.update({
        where: { id: escrowTransaction.id },
        data: {
          paystackReference: verification.reference,
          status: "HELD",
        },
      });

      res.json({
        success: true,
        message: "Payment confirmed. Funds are held in escrow.",
        escrowTransactionId: escrowTransaction.id,
        reference: verification.reference,
        amount: verification.amount,
        currency: verification.currency,
        paidAt: verification.paidAt,
        channel: verification.channel,
      });
    } catch (error) {
      console.error("Error confirming escrow hold:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });

  // ─── POST /api/escrow/release — Landlord confirms move-in, funds released ─────
  router.post("/release", requireAuth, async (req, res) => {
    try {
      const { escrowTransactionId, landlordBankDetails } = req.body;
      const landlordId = req.user.id;

      if (!escrowTransactionId) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: escrowTransactionId",
        });
      }

      // 1. Fetch the escrow transaction
      const escrowTransaction = await prisma.escrowTransaction.findUnique({
        where: { id: escrowTransactionId },
      });

      if (!escrowTransaction) {
        return res.status(404).json({
          success: false,
          error: "Escrow transaction not found",
        });
      }

      // 2. Verify the landlord is the correct recipient
      if (escrowTransaction.landlordId !== landlordId) {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to release this escrow",
        });
      }

      // 3. Verify the transaction is in HELD status
      if (escrowTransaction.status !== "HELD") {
        return res.status(409).json({
          success: false,
          error: `Escrow transaction is already ${escrowTransaction.status.toLowerCase()}. Cannot release.`,
        });
      }

      // 4. Balance check — verify Paystack has sufficient funds before proceeding
      try {
        const balances = await PaystackService.getBalance();
        const ngnBalance = balances.find((b) => b.currency === "NGN");

        if (!ngnBalance) {
          return res.status(402).json({
            success: false,
            error: "No NGN balance found in Paystack escrow account",
            code: "INSUFFICIENT_BALANCE",
          });
        }

        if (ngnBalance.balance < escrowTransaction.amount) {
          return res.status(402).json({
            success: false,
            error: `Insufficient Paystack balance. Required: ₦${escrowTransaction.amount.toLocaleString()}, Available: ₦${ngnBalance.balance.toLocaleString()}`,
            code: "INSUFFICIENT_BALANCE",
            required: escrowTransaction.amount,
            available: ngnBalance.balance,
          });
        }

        console.log(
          `[Escrow] Balance check passed: ₦${ngnBalance.balance.toLocaleString()} available, ` +
          `₦${escrowTransaction.amount.toLocaleString()} required`
        );
      } catch (balanceError) {
        console.error("[Escrow] Balance check failed:", balanceError.message);
        return res.status(503).json({
          success: false,
          error: "Unable to verify Paystack balance before release. Retry when the payment provider is reachable.",
          code: "BALANCE_CHECK_UNAVAILABLE",
        });
      }

      // 5. Create a transfer recipient on Paystack (landlord's bank account)
      let recipientCode;

      if (landlordBankDetails) {
        const recipient = await PaystackService.createTransferRecipient({
          name: landlordBankDetails.name,
          accountNumber: landlordBankDetails.accountNumber,
          bankCode: landlordBankDetails.bankCode,
        });
        recipientCode = recipient.recipientCode;
      } else {
        return res.status(400).json({
          success: false,
          error: "landlordBankDetails (name, accountNumber, bankCode) are required to release funds",
        });
      }

      // 6. Deduct commission, then transfer the net to the landlord
      const transferReference = `LODG-REL-${escrowTransaction.reference.replace("LODG-ESC-", "")}-${Date.now()}`;
      const commissionAmount = Number((escrowTransaction.amount * COMMISSION_RATE).toFixed(2));
      const landlordAmount = Number((escrowTransaction.amount - commissionAmount).toFixed(2));

      const transfer = await PaystackService.transferToLandlord({
        amount: landlordAmount,
        recipientCode,
        reference: transferReference,
        reason: `Rent escrow release — ${escrowTransaction.description || "Lodgist"}`,
      });

      // 7. Update the escrow transaction to RELEASED
      await prisma.escrowTransaction.update({
        where: { id: escrowTransaction.id },
        data: {
          status: "RELEASED",
          releaseDate: new Date(),
          commissionAmount,
        },
      });

      res.json({
        success: true,
        message: "Funds released to landlord successfully.",
        escrowTransactionId: escrowTransaction.id,
        transferCode: transfer.transferCode,
        transferStatus: transfer.status,
        amountReleased: transfer.amount,
      });
    } catch (error) {
      console.error("Error releasing escrow funds:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });

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
