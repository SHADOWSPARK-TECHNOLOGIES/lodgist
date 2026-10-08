const express = require("express");
const { analyzeListing } = require("../services/listingScamDetection");
const { isShareable, parsePreferredDate } = require("../services/whatsapp/tools");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const logger = require("../utils/logger");
const { presentListingImages } = require("../services/objectStorage");

// Renters only. Landlords, agents, and admins book through /api/bookings.
const TENANT_ROLES = new Set(["USER", "TENANT"]);
const OPEN_VIEWING_STATUSES = ["REQUESTED", "SCHEDULED"];
const VIEWING_NOTE_PREFIX = "Requested via web";
const MAX_VIEWING_NOTE = 500;

// Public listing columns. riskState and truthIndex come from migration
// 20260928130000; the lodgist-api pre-deploy step fails if they are missing.
const LISTING_PUBLIC_SELECT = {
  id: true,
  propertyId: true,
  ownerId: true,
  title: true,
  description: true,
  price: true,
  currency: true,
  category: true,
  status: true,
  isFeatured: true,
  views: true,
  isFlaggedForFraud: true,
  fraudReason: true,
  totalMoveInCost: true,
  availableFrom: true,
  furnished: true,
  serviceCharge: true,
  riskState: true,
  truthIndex: true,
  reviewStatus: true,
  createdAt: true,
  updatedAt: true,
};

// Public location is a 500 m area, never the exact pin: coordinates are
// snapped to a 0.005° grid (about 550 m at Owerri's latitude).
const APPROX_GRID_DEG = 0.005;
const APPROX_RADIUS_M = 500;

function dayStamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isPastUtcDay(date) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function publicViewing(row) {
  return {
    id: row.id,
    status: row.status,
    listingId: row.listingId,
    preferredDate: dayStamp(row.preferredDate),
    preferredTime: row.preferredTime || null,
  };
}

function approxLocation(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const snap = (v) => Number((Math.round(v / APPROX_GRID_DEG) * APPROX_GRID_DEG).toFixed(3));
  return { lat: snap(lat), lng: snap(lng), radius_m: APPROX_RADIUS_M };
}

const SORTS = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
};

const LISTING_STATUSES = new Set(["PENDING", "VERIFIED", "REJECTED", "ARCHIVED"]);
// Public discovery is not evidence verification. Anonymous browse returns
// Lodgist-reviewed, non-sample PENDING and VERIFIED homes whose risk is not
// FLAGGED or SUSPENDED. reviewStatus APPROVED is review-for-display only.
// There is no DRAFT status. Sample rows (`totalMoveInCost.sample`) are JSON,
// so findMany still drops them in JS; public `pagination.total` subtracts the
// same sample match so count and data stay aligned. Admin and landlord keep a
// wider result only when they pass an explicit status on this route.
const MANAGEMENT_ROLES = new Set(["STUDIO_ADMIN", "LANDLORD"]);
const PUBLIC_LISTING_STATUSES = ["PENDING", "VERIFIED"];
const ELIGIBLE_RISK_STATES = ["UNVERIFIED", "UNDER_REVIEW", "VERIFIED"];
const BLOCKED_RISK_STATES = new Set(["FLAGGED", "SUSPENDED"]);
const NOT_VERIFIED_LABEL = "Not verified by Lodgist";
const DIRECT_SOURCE_LABEL = "Direct submission";
const REVIEWED_LABEL = "Lodgist-reviewed";
const NOT_REVIEWED_LABEL = "Not reviewed by Lodgist";

function explicitListingStatus(statusQuery) {
  return typeof statusQuery === "string" && LISTING_STATUSES.has(statusQuery) ? statusQuery : null;
}

function isExampleListing(listing) {
  const cost = listing && listing.totalMoveInCost;
  return Boolean(cost && typeof cost === "object" && !Array.isArray(cost) && cost.sample === true);
}

// Review and verification are different. status VERIFIED, riskState VERIFIED,
// reviewStatus APPROVED, and a successful payment are not completed checks.
function isEvidenceVerified() {
  return false;
}

function reviewLabelFor(listing) {
  return listing && listing.reviewStatus === "APPROVED" ? REVIEWED_LABEL : NOT_REVIEWED_LABEL;
}

function isEligiblePublicListing(listing) {
  if (!listing || typeof listing !== "object") return false;
  if (isExampleListing(listing)) return false;
  if (listing.isFlaggedForFraud === true) return false;
  if (listing.reviewStatus !== "APPROVED") return false;
  if (listing.status !== "PENDING" && listing.status !== "VERIFIED") return false;
  if (BLOCKED_RISK_STATES.has(listing.riskState)) return false;
  return true;
}

// Listing has no source column. Public responses say "Direct submission"
// until a real attribution field exists. This does not mark the home verified.
function publicDiscovery(listing) {
  const example = isExampleListing(listing);
  return {
    reviewStatus: listing && listing.reviewStatus === "APPROVED" ? "APPROVED" : "NOT_REVIEWED",
    reviewLabel: reviewLabelFor(listing),
    verificationLabel: isEvidenceVerified(listing) ? "Verified by Lodgist" : NOT_VERIFIED_LABEL,
    sourceLabel: DIRECT_SOURCE_LABEL,
    actions: {
      enquiry: !example,
      viewing: Boolean(isShareable(listing) && !example),
    },
  };
}

function publicRiskFilter() {
  // Prisma 7.8 accepts `{ equals: null }` on this nullable enum.
  // Bare `{ riskState: null }` is what the required-enum client threw
  // ("Argument `riskState` is missing"). `in: [null, ...]` is rejected.
  return {
    OR: [
      { riskState: { equals: null } },
      { riskState: { in: ELIGIBLE_RISK_STATES } },
    ],
  };
}

// Positive match for seed/demo samples. Used to subtract from public count so
// pagination.total matches the post-filter eligible set (isExampleListing).
// NOT (path equals true) is unsafe here: missing `sample` keys become SQL NULL
// and would drop real listings that only store `{ total }`.
function publicSampleMatchFilter() {
  return {
    totalMoveInCost: {
      path: ["sample"],
      equals: true,
    },
  };
}

function withPublicSampleMatch(where) {
  const and = Array.isArray(where.AND) ? where.AND.slice() : [];
  and.push(publicSampleMatchFilter());
  return { ...where, AND: and };
}

async function countPublicBrowse(prisma, where, mode) {
  const rawTotal = await prisma.listing.count({ where });
  if (mode !== "public") return rawTotal;
  const sampleTotal = await prisma.listing.count({ where: withPublicSampleMatch(where) });
  return Math.max(0, rawTotal - sampleTotal);
}

function applyPublicBrowseFilter(where, user, statusQuery) {
  const explicit = explicitListingStatus(statusQuery);
  const management = Boolean(user && MANAGEMENT_ROLES.has(user.role));
  if (management && explicit) {
    where.status = explicit;
    return { mode: "management", where };
  }
  where.status = { in: PUBLIC_LISTING_STATUSES };
  where.reviewStatus = "APPROVED";
  where.isFlaggedForFraud = false;
  const risk = publicRiskFilter();
  where.AND = Array.isArray(where.AND) ? where.AND.concat([risk]) : [risk];
  return { mode: "public", where };
}

function listingsRouter(prisma) {
  const router = express.Router();

  // ─── POST /api/listings/analyze-scam — MUST come before POST / ────────────
  // Uses OpenAI + keyword detection to flag scam listings
  router.post("/analyze-scam", async (req, res) => {
    try {
      const { title, description } = req.body;

      if (!title && !description) {
        return res.status(400).json({
          error: "Please provide a listing title and/or description to analyze.",
        });
      }

      const result = await analyzeListing({ title, description });
      res.json(result);
    } catch (err) {
      console.error("Error analyzing listing for scams:", err);

      if (err.message && err.message.includes("OPENAI_API_KEY")) {
        return res.status(503).json({
          error:
            "Scam detection is temporarily unavailable. The AI analysis service has not been configured yet. Please contact support to enable this feature.",
        });
      }

      res.status(500).json({
        error:
          "Something went wrong while analyzing this listing. Our team has been notified. Please try again later.",
      });
    }
  });

  // ─── GET /api/listings — Public, paginated listing browse ──────────────────
  router.get("/", optionalAuth, async (req, res) => {
    const { q, search, category, status, minPrice, maxPrice, state, area, sort, page: pageQuery } = req.query;
    const queryText = (typeof q === "string" && q) || (typeof search === "string" && search) || "";
    const limitQuery = req.query.limit ?? req.query.pageSize;
    const pageSize = Math.min(50, Math.max(1, parseInt(limitQuery || "12", 10) || 12));
    const page = Math.max(1, parseInt(pageQuery || "1", 10) || 1);
    const orderBy = SORTS[sort] || SORTS.newest;
    const skip = (page - 1) * pageSize;

    try {
      const where = {};

      if (queryText) {
        where.OR = [
          { title: { contains: queryText, mode: "insensitive" } },
          { description: { contains: queryText, mode: "insensitive" } },
        ];
      }

      const propertyWhere = {};
      if (typeof state === "string" && state) {
        propertyWhere.state = { equals: state, mode: "insensitive" };
      }
      if (typeof area === "string" && area) {
        propertyWhere.OR = [
          { city: { contains: area, mode: "insensitive" } },
          { lga: { contains: area, mode: "insensitive" } },
          { address: { contains: area, mode: "insensitive" } },
        ];
      }
      if (Object.keys(propertyWhere).length) where.property = { is: propertyWhere };

      if (category) where.category = category;
      const browse = applyPublicBrowseFilter(where, req.user, status);
      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price.gte = parseFloat(minPrice);
        if (maxPrice) where.price.lte = parseFloat(maxPrice);
      }

      const total = await countPublicBrowse(prisma, where, browse.mode);

      const listings = await prisma.listing.findMany({
        where,
        select: {
          ...LISTING_PUBLIC_SELECT,
          images: {
            orderBy: { order: "asc" },
            select: { id: true, url: true, altText: true, isPrimary: true, order: true },
          },
          property: {
            select: {
              id: true,
              city: true,
              state: true,
              lga: true,
              bedrooms: true,
              bathrooms: true,
              propertyType: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              truthIndex: true,
              isVerified: true,
            },
          },
          fraudSignals: {
            select: { score: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: { reviews: true, bookings: true },
          },
        },
        take: pageSize,
        skip,
        orderBy,
      });

      const listingIds = listings.map((l) => l.id);
      const ratingAggs = listingIds.length > 0
        ? await prisma.review.groupBy({
            by: ["listingId"],
            where: { listingId: { in: listingIds } },
            _avg: { rating: true },
          })
        : [];

      const ratingMap = {};
      for (const agg of ratingAggs) {
        ratingMap[agg.listingId] = agg._avg.rating;
      }

      const visible = browse.mode === "public"
        ? listings.filter((listing) => isEligiblePublicListing(listing))
        : listings;
      const data = await Promise.all(visible.map(async (listing) => {
        const { fraudSignals, _count, ...rest } = listing;
        const latestFraudScore = fraudSignals?.[0]?.score ?? null;
        return {
          ...rest,
          images: await presentListingImages(rest.images),
          ...publicDiscovery(listing),
          averageRating: ratingMap[listing.id] ?? null,
          reviewCount: _count.reviews,
          bookingCount: _count.bookings,
          fraudSignalScore: latestFraudScore,
        };
      }));

      res.json({
        success: true,
        data,
        pagination: {
          total,
          page,
          pages: total === 0 ? 0 : Math.ceil(total / pageSize),
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
          limit: pageSize,
          pageSize,
        },
      });
    } catch (error) {
      logger.error("Error fetching listings", {
        code: error.code || error.name,
        message: error.message,
      });
      res.status(500).json({
        success: false,
        error: "We could not load listings. Try again.",
      });
    }
  });

  // ─── GET /api/listings/:id — Public single listing detail ──────────────────
  router.get("/:id", optionalAuth, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id, 10);
      if (isNaN(listingId)) {
        return res.status(400).json({ error: "Invalid listing ID" });
      }

      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
          ...LISTING_PUBLIC_SELECT,
          images: {
            orderBy: { order: "asc" },
            select: { id: true, url: true, altText: true, isPrimary: true, order: true },
          },
          property: {
            select: {
              id: true,
              city: true,
              state: true,
              lga: true,
              // Read for approxLocation only; stripped before the response.
              latitude: true,
              longitude: true,
              propertyType: true,
              bedrooms: true,
              bathrooms: true,
              size: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              truthIndex: true,
              isVerified: true,
              createdAt: true,
            },
          },
          fraudSignals: {
            select: { score: true, reasoning: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          _count: {
            select: { reviews: true, bookings: true },
          },
        },
      });

      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const management = Boolean(req.user && MANAGEMENT_ROLES.has(req.user.role));
      if (!management && !isEligiblePublicListing(listing)) {
        return res.status(404).json({ error: "Listing not found" });
      }

      // Compute average rating
      const ratingAgg = await prisma.review.aggregate({
        where: { listingId },
        _avg: { rating: true },
        _count: true,
      });

      const { _count, fraudSignals, property, ...listingData } = listing;
      listingData.images = await presentListingImages(listingData.images);
      const latestFraudSignal = fraudSignals?.[0] ?? null;
      let publicProperty = null;
      let approx = null;
      if (property) {
        const { latitude, longitude, ...rest } = property;
        publicProperty = rest;
        approx = approxLocation(latitude, longitude);
      }

      res.json({
        success: true,
        data: {
          ...listingData,
          ...publicDiscovery(listing),
          property: publicProperty,
          approxLocation: approx,
          averageRating: ratingAgg._avg.rating,
          reviewCount: ratingAgg._count,
          bookingCount: _count.bookings,
          latestFraudSignal,
        },
      });
    } catch (error) {
      logger.error("Error fetching single listing", {
        code: error.code || error.name,
        message: error.message,
        listingId: req.params.id,
      });
      res.status(500).json({ success: false, error: "We could not load this listing. Try again." });
    }
  });

  // ─── GET /api/listings/:id/viewing-requests/mine ───────────────────────────
  // Authenticated caller reads only their own latest request. Notes stay off
  // the payload. No listing lookup, so a missing home looks like no request.
  router.get("/:id/viewing-requests/mine", requireAuth, async (req, res) => {
    if (!TENANT_ROLES.has(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Viewing requests are for renter accounts.",
      });
    }
    if (!/^[1-9][0-9]*$/.test(req.params.id || "")) {
      return res.status(400).json({ success: false, error: "Invalid listing ID" });
    }
    const listingId = Number(req.params.id);
    try {
      const row = await prisma.viewingRequest.findFirst({
        where: { listingId, requesterId: req.user.id },
        orderBy: { createdAt: "desc" },
      });
      return res.status(200).json({
        success: true,
        data: row ? publicViewing(row) : null,
      });
    } catch (error) {
      logger.error("Error reading viewing request", {
        code: error.code || error.name,
        message: error.message,
        listingId,
      });
      return res.status(500).json({
        success: false,
        error: "We could not load this viewing request. Try again.",
      });
    }
  });

  // ─── POST /api/listings/:id/viewing-requests ──────────────────────────────
  // Authenticated renter asks to view one listing. Shareable means the same
  // thing as WhatsApp requestViewing: status VERIFIED and not fraud-flagged.
  // An open REQUESTED or SCHEDULED row for this renter and listing is returned
  // unchanged (200, duplicate: true). CANCELLED, COMPLETED, and NO_SHOW do not
  // block a new request. Requester id always comes from the token.
  router.post("/:id/viewing-requests", requireAuth, async (req, res) => {
    if (!TENANT_ROLES.has(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Viewing requests are for renter accounts.",
      });
    }

    if (!/^[1-9][0-9]*$/.test(req.params.id || "")) {
      return res.status(400).json({ success: false, error: "Invalid listing ID" });
    }
    const listingId = Number(req.params.id);

    const preferredDate = parsePreferredDate(req.body && req.body.preferredDate);
    if (!preferredDate) {
      return res.status(400).json({
        success: false,
        error: "preferredDate is required as YYYY-MM-DD.",
      });
    }
    if (isPastUtcDay(preferredDate)) {
      return res.status(400).json({
        success: false,
        error: "preferredDate cannot be in the past.",
      });
    }

    let preferredTime = null;
    if (req.body && req.body.preferredTime != null && req.body.preferredTime !== "") {
      if (typeof req.body.preferredTime !== "string" || req.body.preferredTime.trim().length > 40) {
        return res.status(400).json({ success: false, error: "preferredTime is too long." });
      }
      preferredTime = req.body.preferredTime.trim() || null;
    }

    let notes = VIEWING_NOTE_PREFIX;
    if (req.body && req.body.notes != null && req.body.notes !== "") {
      if (typeof req.body.notes !== "string") {
        return res.status(400).json({ success: false, error: "notes must be text." });
      }
      const extra = req.body.notes.trim();
      if (extra) {
        notes = `${VIEWING_NOTE_PREFIX}. ${extra}`;
        if (notes.length > MAX_VIEWING_NOTE) {
          return res.status(400).json({ success: false, error: "notes are too long." });
        }
      }
    }

    try {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, status: true, isFlaggedForFraud: true, ownerId: true },
      });
      if (!listing) {
        return res.status(404).json({ success: false, error: "Listing not found" });
      }
      if (!isShareable(listing)) {
        return res.status(403).json({
          success: false,
          error: "Viewing requests are only open for verified homes.",
          code: "listing_not_verified",
        });
      }
      if (listing.ownerId === req.user.id) {
        return res.status(403).json({
          success: false,
          error: "You cannot request a viewing of your own listing.",
        });
      }

      const existing = await prisma.viewingRequest.findFirst({
        where: {
          listingId: listing.id,
          requesterId: req.user.id,
          status: { in: OPEN_VIEWING_STATUSES },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          data: publicViewing(existing),
        });
      }

      const created = await prisma.viewingRequest.create({
        data: {
          listingId: listing.id,
          requesterId: req.user.id,
          preferredDate,
          preferredTime,
          notes,
          status: "REQUESTED",
        },
      });

      logger.info("Viewing request created", {
        viewingRequestId: created.id,
        listingId: listing.id,
        requesterId: req.user.id,
      });

      return res.status(201).json({
        success: true,
        duplicate: false,
        data: publicViewing(created),
      });
    } catch (error) {
      logger.error("Error creating viewing request", {
        code: error.code || error.name,
        message: error.message,
        listingId,
      });
      return res.status(500).json({
        success: false,
        error: "We could not save this viewing request. Try again.",
      });
    }
  });

  // ─── GET/PATCH viewing-requests — advertiser response ─────────────────────
  // Owner (or studio admin) lists and answers an existing request.
  // accept → SCHEDULED, decline → CANCELLED. Does not change listing
  // status, reviewStatus, or verification. Notes stay off the response
  // because they can carry a phone number.
  async function loadOwnedListing(req, res) {
    if (!/^[1-9][0-9]*$/.test(req.params.id || "")) {
      res.status(400).json({ success: false, error: "Invalid listing ID" });
      return null;
    }
    const listingId = Number(req.params.id);
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true, status: true, reviewStatus: true },
    });
    if (!listing) {
      res.status(404).json({ success: false, error: "Listing not found" });
      return null;
    }
    const isAdmin = req.user.role === "STUDIO_ADMIN";
    if (!isAdmin && listing.ownerId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: "Only the listing advertiser can manage these viewing requests.",
      });
      return null;
    }
    return listing;
  }

  router.get("/:id/viewing-requests", requireAuth, async (req, res) => {
    try {
      const listing = await loadOwnedListing(req, res);
      if (!listing) return;
      const rows = await prisma.viewingRequest.findMany({
        where: { listingId: listing.id },
        orderBy: { createdAt: "desc" },
      });
      return res.json({
        success: true,
        data: rows.map(publicViewing),
      });
    } catch (error) {
      logger.error("Error listing viewing requests", {
        code: error.code || error.name,
        message: error.message,
      });
      return res.status(500).json({
        success: false,
        error: "We could not load viewing requests. Try again.",
      });
    }
  });

  router.patch("/:id/viewing-requests/:requestId", requireAuth, async (req, res) => {
    const decision = req.body && req.body.decision;
    if (decision !== "accept" && decision !== "decline") {
      return res.status(400).json({
        success: false,
        error: "decision must be accept or decline.",
      });
    }
    if (!/^[1-9][0-9]*$/.test(req.params.requestId || "")) {
      return res.status(400).json({ success: false, error: "Invalid viewing request ID" });
    }
    const requestId = Number(req.params.requestId);
    try {
      const listing = await loadOwnedListing(req, res);
      if (!listing) return;
      const row = await prisma.viewingRequest.findFirst({
        where: { id: requestId, listingId: listing.id },
      });
      if (!row) {
        return res.status(404).json({ success: false, error: "Viewing request not found" });
      }
      if (row.status !== "REQUESTED") {
        return res.status(409).json({
          success: false,
          error: "This viewing request was already answered.",
          data: publicViewing(row),
        });
      }
      const updated = await prisma.viewingRequest.update({
        where: { id: row.id },
        data: decision === "accept"
          ? { status: "SCHEDULED", scheduledAt: row.preferredDate }
          : { status: "CANCELLED" },
      });
      logger.info("Viewing request answered", {
        viewingRequestId: updated.id,
        listingId: listing.id,
        decision,
        status: updated.status,
      });
      return res.json({ success: true, data: publicViewing(updated) });
    } catch (error) {
      logger.error("Error answering viewing request", {
        code: error.code || error.name,
        message: error.message,
      });
      return res.status(500).json({
        success: false,
        error: "We could not save this response. Try again.",
      });
    }
  });

  // ─── POST /api/listings — Auth required, create listing ───────────────────
  router.post("/", requireAuth, async (req, res) => {
    try {
      const { title, description, price, propertyId, category, currency, totalMoveInCost } = req.body;

      // Validation
      if (!title || !description || price === undefined) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: title, description, and price are required",
        });
      }

      // ownerId always from authenticated user, NOT from body
      const ownerId = req.user.id;

      const newListing = await prisma.listing.create({
        data: {
          title,
          description,
          price: parseFloat(price),
          ownerId,
          ...(propertyId && { propertyId: parseInt(propertyId, 10) }),
          ...(category && { category }),
          ...(currency && { currency }),
          ...(totalMoveInCost && { totalMoveInCost }),
          reviewStatus: "NOT_REVIEWED",
        },
        include: {
          images: { select: { id: true, url: true, altText: true, isPrimary: true, order: true } },
          property: { select: { id: true, city: true, state: true } },
          owner: { select: { id: true, name: true } },
        },
      });

      newListing.images = await presentListingImages(newListing.images);
      res.status(201).json({ success: true, data: newListing });
    } catch (error) {
      console.error("Error creating listing:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ─── PUT /api/listings/:id — Auth required, owner-only update ─────────────
  router.put("/:id", requireAuth, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id, 10);
      if (isNaN(listingId)) {
        return res.status(400).json({ success: false, error: "Invalid listing ID" });
      }

      // Verify ownership
      const existing = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!existing) {
        return res.status(404).json({ success: false, error: "Listing not found" });
      }
      if (existing.ownerId !== req.user.id) {
        return res.status(403).json({ success: false, error: "You can only update your own listings" });
      }

      // Only allow specific fields to be updated
      const allowedFields = ["title", "description", "price", "currency", "category", "totalMoveInCost"];
      const updateData = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: "No valid fields to update" });
      }

      const updatedListing = await prisma.listing.update({
        where: { id: listingId },
        data: updateData,
        include: {
          images: { select: { id: true, url: true, altText: true, isPrimary: true, order: true } },
          owner: { select: { id: true, name: true } },
        },
      });

      updatedListing.images = await presentListingImages(updatedListing.images);
      res.json({ success: true, data: updatedListing });
    } catch (error) {
      console.error("Error updating listing:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ─── DELETE /api/listings/:id — Auth required, owner-only delete ──────────
  router.delete("/:id", requireAuth, async (req, res) => {
    try {
      const listingId = parseInt(req.params.id, 10);
      if (isNaN(listingId)) {
        return res.status(400).json({ success: false, error: "Invalid listing ID" });
      }

      // Verify ownership
      const existing = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!existing) {
        return res.status(404).json({ success: false, error: "Listing not found" });
      }
      if (existing.ownerId !== req.user.id) {
        return res.status(403).json({ success: false, error: "You can only delete your own listings" });
      }

      await prisma.listing.delete({ where: { id: listingId } });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting listing:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  return router;
}

module.exports = listingsRouter;
module.exports.approxLocation = approxLocation;
module.exports.applyPublicBrowseFilter = applyPublicBrowseFilter;
module.exports.publicSampleMatchFilter = publicSampleMatchFilter;
module.exports.withPublicSampleMatch = withPublicSampleMatch;
module.exports.countPublicBrowse = countPublicBrowse;
module.exports.isExampleListing = isExampleListing;
module.exports.isEligiblePublicListing = isEligiblePublicListing;
module.exports.publicDiscovery = publicDiscovery;
