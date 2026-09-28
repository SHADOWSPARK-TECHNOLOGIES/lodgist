// Fire-and-forget ping when a new account is created. No-op unless
// SIGNUP_WEBHOOK_URL is set. Sends no email, phone, or name.
function notifySignup({ role, method }, fetchImpl = globalThis.fetch) {
  const url = process.env.SIGNUP_WEBHOOK_URL;
  if (!url || !fetchImpl) return Promise.resolve(false);
  const headers = { "content-type": "application/json" };
  if (process.env.SIGNUP_WEBHOOK_KEY) {
    headers.authorization = `Bearer ${process.env.SIGNUP_WEBHOOK_KEY}`;
  }
  return fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ event: "user.registered", role, method, at: new Date().toISOString() }),
    signal: AbortSignal.timeout(3000),
  })
    .then(() => true)
    .catch((err) => {
      console.warn("signup webhook failed:", err.message);
      return false;
    });
}

module.exports = { notifySignup };
