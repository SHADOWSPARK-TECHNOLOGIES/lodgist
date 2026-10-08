const express = require("express");
const { requireAuth } = require("../middleware/auth");
const logger = require("../utils/logger");
const { defaultStorage, objectKeyFromStoredUrl } = require("../services/objectStorage");
const {
  MAX_LISTING_PHOTOS,
  validatePhoto,
  newObjectKey,
  readPhoto,
} = require("../services/photoUpload");

function positiveInt(value) {
  if (!/^[1-9]\d*$/.test(String(value || ""))) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return null;
  return number;
}

function canManageListing(user, listing) {
  if (!user || !listing) return false;
  if (user.role === "STUDIO_ADMIN") return true;
  return Number(user.id) === Number(listing.ownerId);
}

function storageError(res, error, fallback) {
  const status = error && error.status === 503 ? 503 : 502;
  return res.status(status).json({
    success: false,
    error: status === 503 ? "storage not configured" : fallback,
  });
}

function listingPhotosRouter(prisma, options = {}) {
  const router = express.Router();
  const storage = options.storage || defaultStorage;

  async function loadListing(id) {
    return prisma.listing.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
  }

  // POST /api/listings/:id/photos — owner or STUDIO_ADMIN
  router.post("/:id/photos", requireAuth, async (req, res) => {
    const listingId = positiveInt(req.params.id);
    if (!listingId) {
      if (typeof req.resume === "function") req.resume();
      return res.status(400).json({ success: false, error: "Invalid listing ID" });
    }
    if (!storage.isConfigured()) {
      if (typeof req.resume === "function") req.resume();
      return res.status(503).json({ success: false, error: "storage not configured" });
    }

    try {
      const listing = await loadListing(listingId);
      if (!listing) {
        if (typeof req.resume === "function") req.resume();
        return res.status(404).json({ success: false, error: "Listing not found" });
      }
      if (!canManageListing(req.user, listing)) {
        if (typeof req.resume === "function") req.resume();
        return res.status(403).json({
          success: false,
          error: "You can only change photos on your own listings",
        });
      }

      const count = await prisma.listingImage.count({ where: { listingId } });
      if (count >= MAX_LISTING_PHOTOS) {
        if (typeof req.resume === "function") req.resume();
        return res.status(400).json({
          success: false,
          error: `This listing already has ${MAX_LISTING_PHOTOS} photos.`,
        });
      }

      const uploaded = await readPhoto(req);
      if (uploaded.error) {
        return res.status(uploaded.error.status).json({ success: false, error: uploaded.error.error });
      }
      const validated = validatePhoto(uploaded.file);
      if (!validated.ok) {
        return res.status(validated.status).json({ success: false, error: validated.error });
      }

      const key = newObjectKey(listingId, validated.extension);
      let url;
      try {
        url = await storage.putAndUrl({
          key,
          body: validated.buffer,
          contentType: validated.contentType,
        });
      } catch (error) {
        logger.error("Listing photo upload failed", {
          listingId,
          code: error.code || error.name,
          reason: error.message,
        });
        return storageError(res, error, "We could not store this photo. Try again.");
      }

      try {
        const row = await prisma.listingImage.create({
          data: {
            listingId,
            url,
            altText: null,
            isPrimary: count === 0,
            order: count,
          },
          select: {
            id: true,
            listingId: true,
            url: true,
            altText: true,
            isPrimary: true,
            order: true,
          },
        });
        logger.info("Listing photo stored", { listingId, imageId: row.id, key });
        return res.status(201).json({ success: true, data: row });
      } catch (error) {
        try {
          await storage.deleteObject(key);
        } catch (cleanupError) {
          logger.error("Listing photo cleanup failed", {
            listingId,
            key,
            code: cleanupError.code || cleanupError.name,
            reason: cleanupError.message,
          });
        }
        logger.error("Listing photo row failed", {
          listingId,
          code: error.code || error.name,
          reason: error.message,
        });
        return res.status(500).json({ success: false, error: "We could not save this photo. Try again." });
      }
    } catch (error) {
      logger.error("Listing photo upload failed", {
        listingId,
        code: error.code || error.name,
        reason: error.message,
      });
      return res.status(500).json({ success: false, error: "We could not save this photo. Try again." });
    }
  });

  // DELETE /api/listings/:id/photos/:imageId — owner or STUDIO_ADMIN
  router.delete("/:id/photos/:imageId", requireAuth, async (req, res) => {
    const listingId = positiveInt(req.params.id);
    const imageId = positiveInt(req.params.imageId);
    if (!listingId || !imageId) {
      return res.status(400).json({ success: false, error: "Invalid listing ID" });
    }

    try {
      const listing = await loadListing(listingId);
      if (!listing) {
        return res.status(404).json({ success: false, error: "Listing not found" });
      }
      if (!canManageListing(req.user, listing)) {
        return res.status(403).json({
          success: false,
          error: "You can only change photos on your own listings",
        });
      }

      const image = await prisma.listingImage.findFirst({
        where: { id: imageId, listingId },
      });
      if (!image) {
        return res.status(404).json({ success: false, error: "Photo not found" });
      }

      const key = objectKeyFromStoredUrl(image.url);
      if (key) {
        if (!storage.isConfigured()) {
          return res.status(503).json({ success: false, error: "storage not configured" });
        }
        try {
          await storage.deleteObject(key);
        } catch (error) {
          logger.error("Listing photo delete failed", {
            listingId,
            imageId,
            code: error.code || error.name,
            reason: error.message,
          });
          return storageError(res, error, "We could not remove this photo. Try again.");
        }
      }

      await prisma.listingImage.delete({ where: { id: imageId } });
      if (image.isPrimary) {
        const next = await prisma.listingImage.findFirst({
          where: { listingId },
          orderBy: { order: "asc" },
        });
        if (next) {
          await prisma.listingImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
      logger.info("Listing photo removed", { listingId, imageId, key: key || null });
      return res.json({ success: true });
    } catch (error) {
      logger.error("Listing photo delete failed", {
        listingId,
        imageId,
        code: error.code || error.name,
        reason: error.message,
      });
      return res.status(500).json({ success: false, error: "We could not remove this photo. Try again." });
    }
  });

  return router;
}

module.exports = listingPhotosRouter;
