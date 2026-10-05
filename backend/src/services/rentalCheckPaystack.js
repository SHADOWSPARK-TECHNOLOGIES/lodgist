/**
 * Paystack calls for Rental Safety Check only.
 * Does not use the escrow reference prefix. Never logs the secret.
 */

const axios = require("axios");

const PAYSTACK_API = "https://api.paystack.co";

function notConfigured() {
  const error = new Error("PAYSTACK_SECRET_KEY is not set");
  error.code = "PAYSTACK_NOT_CONFIGURED";
  return error;
}

function authHeaders() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw notConfigured();
  return { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
}

function cleanPaystackError(error) {
  if (error && error.code === "PAYSTACK_NOT_CONFIGURED") return error;
  const status = error && error.response ? error.response.status : null;
  const wrapped = new Error(status ? `Paystack request failed (${status})` : "Paystack request failed");
  wrapped.code = "PAYSTACK_REQUEST_FAILED";
  return wrapped;
}

async function initializeRentalCheckPayment({ email, amountKobo, reference, callbackUrl, metadata }) {
  try {
    const payload = { email, amount: amountKobo, reference, metadata };
    if (callbackUrl) payload.callback_url = callbackUrl;
    const { data } = await axios.post(`${PAYSTACK_API}/transaction/initialize`, payload, {
      headers: authHeaders(),
      timeout: 15000,
    });
    if (!data || !data.status || !data.data || !data.data.authorization_url) {
      throw new Error("Paystack initialize failed");
    }
    return {
      authorization_url: data.data.authorization_url,
      reference: data.data.reference || reference,
    };
  } catch (error) {
    throw cleanPaystackError(error);
  }
}

async function verifyRentalCheckPayment(reference) {
  try {
    const { data } = await axios.get(
      `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: authHeaders(), timeout: 15000 }
    );
    if (!data || !data.status || !data.data) {
      throw new Error("Paystack verification failed");
    }
    return {
      status: data.data.status,
      reference: data.data.reference,
      amountKobo: data.data.amount,
      currency: data.data.currency,
    };
  } catch (error) {
    throw cleanPaystackError(error);
  }
}

module.exports = {
  initializeRentalCheckPayment,
  verifyRentalCheckPayment,
};
