// Decides, before rendering, whether /listings/<id> is a missing listing.
// See listingNotFoundRoute.test.js for why this lives in the proxy.
const { isValidListingId } = require("./requestTimeout");

const MISSING_LISTING_PATH = "/listing-not-found";
const LOOKUP_TIMEOUT_MS = 8000;

/** Anonymous public lookup; resolves to the HTTP status. */
async function lookupStatus(id, apiBase, fetchImpl = fetch) {
  const base = String(apiBase).replace(/\/$/, "");
  const res = await fetchImpl(`${base}/api/listings/${id}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  return res.status;
}

/**
 * null = render the normal page. Only a definite 404 counts as missing; an API
 * outage or timeout still renders the page so its own retry state can show.
 */
async function listingRouteDecision(id, getStatus) {
  if (!isValidListingId(id)) return { rewrite: `${MISSING_LISTING_PATH}/invalid`, status: 404 };
  try {
    if ((await getStatus(id)) === 404) return { rewrite: `${MISSING_LISTING_PATH}/${id}`, status: 404 };
  } catch {
    // fall through
  }
  return null;
}

module.exports = { MISSING_LISTING_PATH, LOOKUP_TIMEOUT_MS, lookupStatus, listingRouteDecision };
