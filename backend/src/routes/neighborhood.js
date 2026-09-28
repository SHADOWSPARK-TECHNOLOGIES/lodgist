// N6: GET /api/neighborhood/nearby?listingId=<id>&radiusM=1500&category=<optional>
// Privacy: Google is queried from, and distances are measured from, the 0.005°
// snapped point. The exact property coordinates never leave this handler.
//
// Caching: Google Maps Platform Terms §3.2.3(b) forbid caching Google Maps Content
// except as the Service Specific Terms allow. For Places API that is place IDs
// (indefinitely) and lat/lng (up to 30 days), not names, addresses or types.
// So Places responses are never stored here and are sent with Cache-Control: no-store.
//   https://cloud.google.com/maps-platform/terms (3.2.3(b) No Caching)
//   https://cloud.google.com/maps-platform/terms/maps-service-terms (14.3 Caching)
//   https://developers.google.com/maps/documentation/places/web-service/policies
const express = require("express");
const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");
const { parseNearbyQuery, isUsableCoordinate } = require("../lib/neighborhood/validation");
const { typesFor } = require("../lib/neighborhood/categories");
const { snapToApproxGrid } = require("../lib/neighborhood/distance");
const { searchNearby } = require("../lib/neighborhood/googlePlaces");
const { normalizePlaces } = require("../lib/neighborhood/normalize");

// ListingStatus has no ACTIVE/PUBLISHED; VERIFIED is the published state.
const PUBLIC_LISTING_STATUSES = Object.freeze(["VERIFIED"]);
const ATTRIBUTION = Object.freeze({ provider: "Google Maps", required: true });

function neighborhoodRouter(prisma, options = {}) {
  const router = express.Router();
  const fetchImpl = options.fetch || ((...args) => globalThis.fetch(...args));
  const getApiKey = () => ("apiKey" in options ? options.apiKey : process.env.GOOGLE_PLACES_API_KEY);

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: options.rateLimitMax || 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: "RATE_LIMITED", error: "Too many requests, please try again later." },
  });

  router.get("/nearby", limiter, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const q = parseNearbyQuery(req.query);
    if (!q.ok) return res.status(q.status).json({ success: false, code: q.code, error: q.error });
    const { listingId, radiusM, category } = q;

    let listing;
    try {
      listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, status: true, property: { select: { latitude: true, longitude: true } } },
      });
    } catch (error) {
      logger.error("neighborhood: listing lookup failed", { code: error.code || error.name, listingId });
      return res.status(500).json({ success: false, code: "INTERNAL_ERROR", error: "We could not load this listing. Try again." });
    }
    // Unpublished listings look exactly like missing ones.
    if (!listing || !PUBLIC_LISTING_STATUSES.includes(listing.status)) {
      return res.status(404).json({ success: false, code: "LISTING_NOT_FOUND", error: "Listing not found" });
    }

    const { latitude, longitude } = listing.property || {};
    const approx = isUsableCoordinate(latitude, longitude) ? snapToApproxGrid(latitude, longitude) : null;
    if (!approx) {
      return res.status(422).json({
        success: false,
        code: "PROPERTY_LOCATION_UNAVAILABLE",
        error: "This listing does not have a location yet.",
      });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        code: "NEIGHBORHOOD_UNAVAILABLE",
        error: "Nearby places are not available right now.",
      });
    }

    let places;
    try {
      places = await searchNearby({
        apiKey,
        lat: approx.lat,
        lng: approx.lng,
        radiusM,
        includedTypes: typesFor(category),
        fetchImpl,
        timeoutMs: options.timeoutMs,
      });
    } catch (error) {
      const timeout = error.kind === "timeout";
      logger.warn("neighborhood: Google Places failed", { kind: error.kind || "unknown", status: error.status, listingId });
      return res.status(timeout ? 504 : 502).json({
        success: false,
        code: "NEIGHBORHOOD_UNAVAILABLE",
        error: "Nearby places are not available right now. Try again later.",
      });
    }

    return res.json({
      success: true,
      data: {
        listingId,
        approxLocation: approx,
        radiusM,
        category,
        places: normalizePlaces(places, approx, category),
        source: "google_places",
        attribution: ATTRIBUTION,
      },
    });
  });

  return router;
}

module.exports = neighborhoodRouter;
module.exports.PUBLIC_LISTING_STATUSES = PUBLIC_LISTING_STATUSES;
