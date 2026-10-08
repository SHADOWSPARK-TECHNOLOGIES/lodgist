/**
 * Paystack checkout is shelved (founder decision, 8 Oct 2026).
 * It runs only when PAYSTACK_ENABLED is the string "true" and PAYSTACK_SECRET_KEY is set.
 * A missing key must not start checkout and must not throw on the user path.
 */
function paystackEnabled() {
  return process.env.PAYSTACK_ENABLED === "true" && Boolean(process.env.PAYSTACK_SECRET_KEY);
}

module.exports = { paystackEnabled };
