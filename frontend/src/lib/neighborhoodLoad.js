// Server-side listing load for /listings/<id>/neighborhood, with the app's
// standard request timeout so a hung API cannot stall the page.
const { REQUEST_TIMEOUT_MS, timeoutSignal } = require("./requestTimeout");

/** Resolves to { kind: "ok", listing } | { kind: "missing" | "timeout" | "error" }. */
async function loadNeighborhoodListing(id, apiBase, fetchImpl = fetch, ms = REQUEST_TIMEOUT_MS) {
  const base = String(apiBase).replace(/\/$/, "");
  const timer = timeoutSignal(null, ms);
  try {
    const response = await fetchImpl(`${base}/api/listings/${id}`, { cache: "no-store", signal: timer.signal });
    if (response.status === 404) return { kind: "missing" };
    if (!response.ok) return { kind: "error" };
    const body = await response.json();
    return body && body.data ? { kind: "ok", listing: body.data } : { kind: "error" };
  } catch {
    return timer.timedOut() ? { kind: "timeout" } : { kind: "error" };
  } finally {
    timer.cleanup();
  }
}

module.exports = { loadNeighborhoodListing };
