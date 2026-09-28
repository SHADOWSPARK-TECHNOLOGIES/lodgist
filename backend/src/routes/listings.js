const express = require("express");
const { analyzeListing } = require("../services/listingScamDetection");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const logger = require("../utils/logger");

// Columns that exist in the baseline migration. riskState and truthIndex are
// selected only after 20260928130000 is applied; omitting them here keeps
// browse working on a database that has not been migrated yet.
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
  createdAt: true,
  updatedAt: true,
};

module.exports = (prisma) => {
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
    const { q, search, category, status, minPrice, maxPrice, page: pageQuery } = req.query;
    const queryText = (typeof q === "string" && q) || (typeof search === "string" && search) || "";
    const pageSize = 12;
    const page = Math.max(1, parseInt(pageQuery || "1", 10) || 1);
    const skip = (page - 1) * pageSize;

    try {
      const where = {};

      if (queryText) {
        where.OR = [
          { title: { contains: queryText, mode: "insensitive" } },
          { description: { contains: queryText, mode: "insensitive" } },
        ];
      }

      if (category) where.category = category;
      if (status) where.status = status;
      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price.gte = parseFloat(minPrice);
        if (maxPrice) where.price.lte = parseFloat(maxPrice);
      }

      const total = await prisma.listing.count({ where });

      const listings = await prisma.listing.findMany({
        where,
        select: {
          ...LISTING_PUBLIC_SELECT,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true, altText: true },
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
              email: true,
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
        orderBy: { createdAt: "desc" },
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

      const data = listings.map((listing) => {
        const { fraudSignals, _count, ...rest } = listing;
        const latestFraudScore = fraudSignals?.[0]?.score ?? null;
        return {
          ...rest,
          averageRating: ratingMap[listing.id] ?? null,
          reviewCount: _count.reviews,
          bookingCount: _count.bookings,
          fraudSignalScore: latestFraudScore,
        };
      });

      res.json({
        success: true,
        data,
        pagination: {
          total,
          page,
          pages: total === 0 ? 0 : Math.ceil(total / pageSize),
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
            select: { url: true, altText: true, isPrimary: true },
          },
          property: {
            select: {
              id: true,
              address: true,
              city: true,
              state: true,
              lga: true,
              landmark: true,
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
              email: true,
              phone: true,
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

      // Compute average rating
      const ratingAgg = await prisma.review.aggregate({
        where: { listingId },
        _avg: { rating: true },
        _count: true,
      });

      const { _count, fraudSignals, ...listingData } = listing;
      const latestFraudSignal = fraudSignals?.[0] ?? null;

      res.json({
        success: true,
        data: {
          ...listingData,
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
        },
        include: {
          images: { select: { url: true, altText: true, isPrimary: true } },
          property: { select: { id: true, city: true, state: true } },
          owner: { select: { id: true, name: true } },
        },
      });

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
          images: { select: { url: true, altText: true, isPrimary: true } },
          owner: { select: { id: true, name: true } },
        },
      });

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
};
