const express = require("express");
const { requireAuth } = require("../middleware/auth");

module.exports = (prisma) => {
  const router = express.Router();

  // ─── GET /api/reviews/:listingId — Public, fetch reviews for a listing ────
  router.get("/:listingId", async (req, res) => {
    try {
      const listingId = parseInt(req.params.listingId, 10);
      if (isNaN(listingId)) {
        return res.status(400).json({ success: false, error: "Invalid listing ID" });
      }

      const { page: pageQuery } = req.query;
      const pageSize = 10;
      const page = Math.max(1, parseInt(pageQuery || "1", 10));
      const skip = (page - 1) * pageSize;

      const total = await prisma.review.count({ where: { listingId } });

      const reviews = await prisma.review.findMany({
        where: { listingId },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip,
      });

      // Get aggregate stats
      const aggregate = await prisma.review.aggregate({
        where: { listingId },
        _avg: { rating: true },
        _count: true,
      });

      res.json({
        success: true,
        data: reviews,
        stats: {
          averageRating: aggregate._avg.rating,
          totalReviews: aggregate._count,
        },
        pagination: {
          total,
          page,
          pages: Math.ceil(total / pageSize),
          pageSize,
        },
      });
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ─── POST /api/reviews — Auth required, create a review ───────────────────
  router.post("/", requireAuth, async (req, res) => {
    try {
      const { listingId, rating, comment } = req.body;
      const userId = req.user.id;

      // Validation
      if (!listingId) {
        return res.status(400).json({
          success: false,
          error: "listingId is required",
        });
      }

      if (rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: "rating must be between 1 and 5",
        });
      }

      // Check listing exists
      const listing = await prisma.listing.findUnique({
        where: { id: parseInt(listingId, 10) },
      });
      if (!listing) {
        return res.status(404).json({ success: false, error: "Listing not found" });
      }

      // Check for duplicate review (one review per user per listing)
      const existingReview = await prisma.review.findUnique({
        where: {
          listingId_userId: {
            listingId: parseInt(listingId, 10),
            userId,
          },
        },
      });

      if (existingReview) {
        return res.status(409).json({
          success: false,
          error: "You have already reviewed this listing",
        });
      }

      const review = await prisma.review.create({
        data: {
          listingId: parseInt(listingId, 10),
          userId,
          rating,
          comment: comment || null,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      res.status(201).json({ success: true, data: review });
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ─── PUT /api/reviews/:id — Auth required, update own review ──────────────
  router.put("/:id", requireAuth, async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id, 10);
      if (isNaN(reviewId)) {
        return res.status(400).json({ success: false, error: "Invalid review ID" });
      }

      const { rating, comment } = req.body;

      // Verify ownership
      const existing = await prisma.review.findUnique({ where: { id: reviewId } });
      if (!existing) {
        return res.status(404).json({ success: false, error: "Review not found" });
      }
      if (existing.userId !== req.user.id) {
        return res.status(403).json({ success: false, error: "You can only edit your own reviews" });
      }

      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return res.status(400).json({ success: false, error: "rating must be between 1 and 5" });
      }

      const updateData = {};
      if (rating !== undefined) updateData.rating = rating;
      if (comment !== undefined) updateData.comment = comment;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: "No fields to update" });
      }

      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: updateData,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      res.json({ success: true, data: updatedReview });
    } catch (error) {
      console.error("Error updating review:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ─── DELETE /api/reviews/:id — Auth required, delete own review ───────────
  router.delete("/:id", requireAuth, async (req, res) => {
    try {
      const reviewId = parseInt(req.params.id, 10);
      if (isNaN(reviewId)) {
        return res.status(400).json({ success: false, error: "Invalid review ID" });
      }

      const existing = await prisma.review.findUnique({ where: { id: reviewId } });
      if (!existing) {
        return res.status(404).json({ success: false, error: "Review not found" });
      }
      if (existing.userId !== req.user.id) {
        return res.status(403).json({ success: false, error: "You can only delete your own reviews" });
      }

      await prisma.review.delete({ where: { id: reviewId } });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  return router;
};
