const express = require("express");
const spatial = require("../../../packages/spatial-core");
const { approxLocation, isEligiblePublicListing } = require("./listings");

const URL_KEYS = ["url", "providerUrl", "userUrl", "endpoint", "baseUrl", "tileUrl", "interpreterUrl"];
const MAX_BODY_CHARS = 32 * 1024;

function hasUrlKey(value) {
  if (!value || typeof value !== "object") return false;
  return URL_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key) && value[key] != null && value[key] !== "");
}

async function loadListingFromPrisma(prisma, id) {
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) return null;
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      status: true,
      reviewStatus: true,
      riskState: true,
      isFlaggedForFraud: true,
      category: true,
      totalMoveInCost: true,
      property: { select: { city: true, state: true, lga: true, latitude: true, longitude: true } },
    },
  });
  if (!listing || !isEligiblePublicListing(listing)) return null;
  const property = listing.property || {};
  return {
    id: listing.id,
    title: listing.title,
    status: listing.status,
    reviewStatus: listing.reviewStatus,
    riskState: listing.riskState,
    category: listing.category,
    public: true,
    property: { city: property.city, state: property.state, lga: property.lga },
    approxLocation: approxLocation(property.latitude, property.longitude),
  };
}

function createSpatialRouter(options = {}) {
  const router = express.Router();

  router.post("/tool", async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ ok: false, code: "malformed" });
    }
    if (JSON.stringify(body).length > MAX_BODY_CHARS || hasUrlKey(body) || hasUrlKey(body.input)) {
      return res.status(400).json({ ok: false, code: "forbidden" });
    }
    try {
      const input = body.input && typeof body.input === "object" && !Array.isArray(body.input) ? body.input : {};
      const ids = [];
      if (input.listingId != null) ids.push(input.listingId);
      if (Array.isArray(input.listingIds)) ids.push(...input.listingIds);
      const listings = [];
      for (const id of ids) {
        const listing = typeof options.loadListing === "function"
          ? await options.loadListing(id)
          : options.prisma
            ? await loadListingFromPrisma(options.prisma, id)
            : null;
        if (listing) listings.push(listing);
      }
      const result = await spatial.callTool(String(body.name || ""), input, {
        listings,
        isPublicListing: (listing) => Boolean(listing && listing.public === true),
        env: options.env || {},
        fetchImpl: options.fetchImpl,
        lookup: options.lookup,
        registry: options.registry,
        safeguardState: options.safeguardState,
        log: options.log,
      });
      const status = result.ok ? 200 : (result.code === "malformed" || result.code === "forbidden" ? 400 : 502);
      return res.status(status).json(result);
    } catch {
      return res.status(502).json({ ok: false, code: "unavailable" });
    }
  });

  return router;
}

module.exports = createSpatialRouter;
module.exports.loadListingFromPrisma = loadListingFromPrisma;
