// N6: GET /api/neighborhood/nearby?listingId=<id>&radiusM=1500&category=<optional>
// Privacy: Google is queried from, and distances are measured from, the 0.005°
// snapped point. The exact property coordinates never leave this handler.
const express = require("express");
const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");
const { parseNearbyQuery, isUsableCoordinate } = require("../lib/neighborhood/validation");
const { typesFor } = require("../lib/neighborhood/categories");
const { snapToApproxGrid } = require("../lib/neighborhood/distance");
const { searchNearby } = require("../lib/neighborhood/googlePlaces");
const { normalizePlaces } = require("../lib/neighborhood/normalize");

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;

function createCache({ ttlMs = CACHE_TTL_MS, maxEntries = CACHE_MAX_ENTRIES, now = Date.now } = {}) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= now()) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      if (map.size >= maxEntries && !map.has(key)) map.delete(map.keys().next().value);
      map.set(key, { value, expiresAt: now() + ttlMs });
    },
    get size() {
      return map.size;
    },
  };
}

function cacheKey(listingId, radiusM, category) {
  return `neighborhood:${listingId}:${radiusM}:${category || "all"}:v1`;
}

function neighborhoodRouter(prisma, options = {}) {
  const router = express.Router();
  const cache = options.cache || createCache();
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
    const q = parseNearbyQuery(req.query);
    if (!q.ok) return res.status(q.status).json({ success: false, code: q.code, error: q.error });
    const { listingId, radiusM, category } = q;

    const key = cacheKey(listingId, radiusM, category);
    const cached = cache.get(key);
    if (cached) return res.json({ success: true, cached: true, data: cached });

    let listing;
    try {
      listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, property: { select: { latitude: true, longitude: true } } },
      });
    } catch (error) {
      logger.error("neighborhood: listing lookup failed", { code: error.code || error.name, listingId });
      return res.status(500).json({ success: false, code: "INTERNAL_ERROR", error: "We could not load this listing. Try again." });
    }
    if (!listing) return res.status(404).json({ success: false, code: "LISTING_NOT_FOUND", error: "Listing not found" });

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

    const data = {
      listingId,
      approxLocation: approx,
      radiusM,
      category,
      places: normalizePlaces(places, approx, category),
      source: "google_places",
    };
    cache.set(key, data);
    return res.json({ success: true, cached: false, data });
  });

  return router;
}

module.exports = neighborhoodRouter;
module.exports.createCache = createCache;
module.exports.cacheKey = cacheKey;
module.exports.CACHE_TTL_MS = CACHE_TTL_MS;
