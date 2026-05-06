/**
 * PaystackService — Paystack API integration for Lodgist escrow payments.
 *
 * Endpoints used:
 *   POST /transaction/initialize   — Create a payment link
 *   GET  /transaction/verify/:ref  — Verify a completed payment
 *   POST /transfer                 — Transfer funds to a recipient (landlord)
 *   POST /transferrecipient        — Create a transfer recipient (landlord's bank account)
 *
 * All amounts are in **kobo** (NGN × 100) as required by Paystack.
 */

const axios = require("axios");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API = "https://api.paystack.co";

if (!PAYSTACK_SECRET_KEY) {
  console.warn(
    "[PaystackService] WARNING: PAYSTACK_SECRET_KEY is not set. " +
      "All Paystack calls will fail until it is configured."
  );
}

/** Shared Axios instance pre-configured with auth header. */
const api = axios.create({
  baseURL: PAYSTACK_API,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 15_000,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert NGN to kobo (Paystack's smallest currency unit).
 * @param {number} amountNGN
 * @returns {number}
 */
function toKobo(amountNGN) {
  return Math.round(amountNGN * 100);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize a Paystack transaction (creates a payment link).
 *
 * @param {object} params
 * @param {string} params.email       – Customer email (tenant)
 * @param {number} params.amount      – Amount in NGN (will be converted to kobo)
 * @param {string} params.reference   – Unique transaction reference
 * @param {object} [params.metadata]  – Extra data (escrowTransactionId, etc.)
 * @param {string} [params.callbackUrl] – Where to redirect after payment
 * @returns {Promise<{ authorization_url: string, reference: string, access_code: string }>}
 */
async function initializePayment({
  email,
  amount,
  reference,
  metadata = {},
  callbackUrl,
}) {
  if (!email) throw new Error("email is required");
  if (amount == null || amount <= 0) throw new Error("amount must be a positive number");
  if (!reference) throw new Error("reference is required");

  const payload = {
    email,
    amount: toKobo(amount),
    reference,
    metadata,
  };

  if (callbackUrl) {
    payload.callback_url = callbackUrl;
  }

  const { data } = await api.post("/transaction/initialize", payload);

  if (!data.status || !data.data) {
    throw new Error(`Paystack initialize failed: ${data.message}`);
  }

  return {
    authorization_url: data.data.authorization_url,
    reference: data.data.reference,
    access_code: data.data.access_code,
  };
}

/**
 * Verify a Paystack transaction by reference.
 *
 * @param {string} reference – The transaction reference returned by initializePayment
 * @returns {Promise<{
 *   status: string,
 *   reference: string,
 *   amount: number,
 *   currency: string,
 *   paidAt: string,
 *   channel: string,
 *   customer: { email: string, phone?: string },
 *   metadata: object|null,
 * }>}
 */
async function verifyPayment(reference) {
  if (!reference) throw new Error("reference is required");

  const { data } = await api.get(`/transaction/verify/${reference}`);

  if (!data.status || !data.data) {
    throw new Error(`Paystack verification failed: ${data.message}`);
  }

  const d = data.data;

  return {
    status: d.status, // "success" | "failed" | "abandoned"
    reference: d.reference,
    amount: d.amount / 100, // Convert back from kobo to NGN
    currency: d.currency,
    paidAt: d.paid_at,
    channel: d.channel,
    customer: {
      email: d.customer?.email,
      phone: d.customer?.phone,
    },
    metadata: d.metadata ?? null,
  };
}

/**
 * Create a transfer recipient on Paystack (the landlord's bank account).
 *
 * @param {object} params
 * @param {string} params.name           – Landlord's name
 * @param {string} params.accountNumber  – Bank account number
 * @param {string} params.bankCode       – Paystack bank code (e.g., "011" for First Bank)
 * @returns {Promise<{ recipientCode: string, recipientId: number }>}
 */
async function createTransferRecipient({ name, accountNumber, bankCode }) {
  if (!name) throw new Error("name is required");
  if (!accountNumber) throw new Error("accountNumber is required");
  if (!bankCode) throw new Error("bankCode is required");

  const { data } = await api.post("/transferrecipient", {
    type: "nuban",
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: "NGN",
  });

  if (!data.status || !data.data) {
    throw new Error(`Paystack create recipient failed: ${data.message}`);
  }

  return {
    recipientCode: data.data.recipient_code,
    recipientId: data.data.id,
  };
}

/**
 * Trigger a transfer from the Paystack escrow balance to a landlord's bank account.
 *
 * @param {object} params
 * @param {number} params.amount         – Amount in NGN (will be converted to kobo)
 * @param {string} params.recipientCode  – Paystack recipient code from createTransferRecipient
 * @param {string} params.reference      – Unique transfer reference (e.g., ESCROW-RELEASE-xxx)
 * @param {string} [params.reason]       – Transfer reason / narration
 * @returns {Promise<{ transferCode: string, status: string, amount: number }>}
 */
async function transferToLandlord({ amount, recipientCode, reference, reason }) {
  if (amount == null || amount <= 0) throw new Error("amount must be a positive number");
  if (!recipientCode) throw new Error("recipientCode is required");
  if (!reference) throw new Error("reference is required");

  const payload = {
    source: "balance",
    amount: toKobo(amount),
    recipient: recipientCode,
    reference,
    reason: reason || "Rent escrow release — Lodgist",
  };

  const { data } = await api.post("/transfer", payload);

  if (!data.status || !data.data) {
    throw new Error(`Paystack transfer failed: ${data.message}`);
  }

  return {
    transferCode: data.data.transfer_code,
    status: data.data.status, // "success" | "pending" | "failed"
    amount: data.data.amount / 100,
  };
}

/**
 * Fetch the Paystack balance to confirm sufficient funds before a transfer.
 *
 * @returns {Promise<{ currency: string, balance: number }[]>}
 */
async function getBalance() {
  const { data } = await api.get("/balance");

  if (!data.status) {
    throw new Error(`Paystack balance check failed: ${data.message}`);
  }

  return data.data.map((b) => ({
    currency: b.currency,
    balance: b.balance / 100, // Convert from kobo
  }));
}

module.exports = {
  initializePayment,
  verifyPayment,
  createTransferRecipient,
  transferToLandlord,
  getBalance,
};
