/** Parse express.raw Buffer or already-parsed JSON. Invalid JSON -> null. */
function parseWebhookBody(body) {
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString("utf8"));
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" ? body : null;
}

module.exports = { parseWebhookBody };
