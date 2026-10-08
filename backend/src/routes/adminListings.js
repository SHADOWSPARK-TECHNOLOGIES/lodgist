const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const logger = require("../utils/logger");
const {
  isExampleListing,
  isEligiblePublicListing,
  isEvidenceVerified,
  publicationState,
} = require("./listings");

const NOT_VERIFIED_LABEL = "Not verified by Lodgist";
const VERIFIED_LABEL = "Verified by Lodgist";
const REVIEWED_LABEL = "Lodgist-reviewed";
const NOT_REVIEWED_LABEL = "Not reviewed by Lodgist";
const MAX_REASON = 500;
const MAX_AUDIT = 50;
const BLOCKED_RISK = new Set(["FLAGGED", "SUSPENDED"]);

const ADMIN_SELECT = {
  id: true,
  title: true,
  description: true,
  price: true,
  currency: true,
  status: true,
  reviewStatus: true,
  riskState: true,
  isFlaggedForFraud: true,
  totalMoveInCost: true,
  evidenceVerified: true,
  verifiedAt: true,
  verifiedById: true,
  rejectionReason: true,
  adminAudit: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  property: { select: { city: true, state: true, lga: true } },
  owner: { select: { id: true, name: true } },
};

function reviewLabel(listing) {
  return listing && listing.reviewStatus === "APPROVED" ? REVIEWED_LABEL : NOT_REVIEWED_LABEL;
}

function adminView(listing) {
  const verified = isEvidenceVerified(listing);
  const audit = Array.isArray(listing.adminAudit) ? listing.adminAudit : [];
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    currency: listing.currency,
    status: listing.status,
    reviewStatus: listing.reviewStatus === "APPROVED" ? "APPROVED" : "NOT_REVIEWED",
    publicationState: publicationState(listing),
    publiclyListed: isEligiblePublicListing(listing),
    example: isExampleListing(listing),
    evidenceVerified: verified,
    verifiedAt: verified ? listing.verifiedAt : null,
    verifiedById: verified ? listing.verifiedById : null,
    verificationLabel: verified ? VERIFIED_LABEL : NOT_VERIFIED_LABEL,
    reviewLabel: reviewLabel(listing),
    rejectionReason: typeof listing.rejectionReason === "string" ? listing.rejectionReason : null,
    riskState: listing.riskState ?? null,
    isFlaggedForFraud: listing.isFlaggedForFraud === true,
    property: listing.property || null,
    owner: listing.owner || null,
    latestAudit: audit.length ? audit[audit.length - 1] : null,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}

function appendAudit(listing, entry) {
  const prior = Array.isArray(listing.adminAudit)
    ? listing.adminAudit.filter((item) => item && typeof item === "object")
    : [];
  const next = prior.concat([entry]);
  return next.length > MAX_AUDIT ? next.slice(next.length - MAX_AUDIT) : next;
}

function auditEntry(listing, action, adminId, reason) {
  return {
    action,
    adminId,
    listingId: listing.id,
    at: new Date().toISOString(),
    reason: reason || null,
    publicationState: publicationState(listing),
    evidenceVerified: isEvidenceVerified(listing),
  };
}

function parseListingId(value) {
  if (!/^[1-9][0-9]*$/.test(value || "")) return null;
  return Number(value);
}

function rejectionReason(body) {
  const reason = body && body.reason;
  if (typeof reason !== "string") return { error: "A rejection reason is required." };
  const trimmed = reason.trim();
  if (!trimmed) return { error: "A rejection reason is required." };
  if (trimmed.length > MAX_REASON) return { error: "That reason is too long." };
  return { reason: trimmed };
}

function cannotPublish(listing) {
  if (isExampleListing(listing)) return "Example listings cannot be published.";
  if (listing.isFlaggedForFraud === true) return "Flagged listings cannot be published.";
  if (BLOCKED_RISK.has(listing.riskState)) return "Flagged or suspended listings cannot be published.";
  if (listing.status === "ARCHIVED") return "Archived listings cannot be published.";
  if (listing.status !== "PENDING" && listing.status !== "VERIFIED" && listing.status !== "REJECTED") {
    return "This listing cannot be published.";
  }
  return null;
}

function adminListingsRouter(prisma) {
  const router = express.Router();
  router.use(requireAuth, requireRole("STUDIO_ADMIN"));

  async function loadListing(id) {
    return prisma.listing.findUnique({ where: { id }, select: ADMIN_SELECT });
  }

  async function writeListing(existing, data, res) {
    const updated = await prisma.listing.update({
      where: { id: existing.id },
      data,
    });
    return res.json({ success: true, data: adminView({ ...existing, ...updated }) });
  }

  router.get("/pending", asyncHandler(async (_req, res) => {
    try {
      const rows = await prisma.listing.findMany({
        where: {
          reviewStatus: "NOT_REVIEWED",
          status: { in: ["PENDING", "VERIFIED"] },
        },
        select: ADMIN_SELECT,
        orderBy: { createdAt: "asc" },
      });
      return res.json({
        success: true,
        data: rows.map(adminView),
      });
    } catch (error) {
      logger.error("Error listing pending listings", {
        code: error.code || error.name,
        message: error.message,
      });
      return res.status(500).json({ success: false, error: "We could not load pending listings. Try again." });
    }
  }));

  router.post("/:id/approve", asyncHandler(async (req, res) => {
    const id = parseListingId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid listing ID" });
    try {
      const existing = await loadListing(id);
      if (!existing) return res.status(404).json({ success: false, error: "Listing not found" });
      const blocked = cannotPublish(existing);
      if (blocked) return res.status(409).json({ success: false, error: blocked });
      if (existing.reviewStatus === "APPROVED" && (existing.status === "PENDING" || existing.status === "VERIFIED")) {
        return res.json({ success: true, unchanged: true, data: adminView(existing) });
      }
      const nextStatus = existing.status === "VERIFIED" ? "VERIFIED" : "PENDING";
      const merged = {
        ...existing,
        reviewStatus: "APPROVED",
        status: nextStatus,
        rejectionReason: null,
      };
      return await writeListing(existing, {
        reviewStatus: "APPROVED",
        status: nextStatus,
        rejectionReason: null,
        adminAudit: appendAudit(existing, auditEntry(merged, "approve", req.user.id, null)),
      }, res);
    } catch (error) {
      logger.error("Error approving listing", {
        code: error.code || error.name,
        message: error.message,
        listingId: id,
      });
      return res.status(500).json({ success: false, error: "We could not publish this listing. Try again." });
    }
  }));

  router.post("/:id/reject", asyncHandler(async (req, res) => {
    const id = parseListingId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid listing ID" });
    const parsed = rejectionReason(req.body);
    if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });
    try {
      const existing = await loadListing(id);
      if (!existing) return res.status(404).json({ success: false, error: "Listing not found" });
      if (existing.status === "REJECTED" && existing.rejectionReason === parsed.reason && existing.reviewStatus === "NOT_REVIEWED") {
        return res.json({ success: true, unchanged: true, data: adminView(existing) });
      }
      const merged = {
        ...existing,
        status: "REJECTED",
        reviewStatus: "NOT_REVIEWED",
        rejectionReason: parsed.reason,
      };
      return await writeListing(existing, {
        status: "REJECTED",
        reviewStatus: "NOT_REVIEWED",
        rejectionReason: parsed.reason,
        adminAudit: appendAudit(existing, auditEntry(merged, "reject", req.user.id, parsed.reason)),
      }, res);
    } catch (error) {
      logger.error("Error rejecting listing", {
        code: error.code || error.name,
        message: error.message,
        listingId: id,
      });
      return res.status(500).json({ success: false, error: "We could not reject this listing. Try again." });
    }
  }));

  router.post("/:id/verify", asyncHandler(async (req, res) => {
    const id = parseListingId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid listing ID" });
    try {
      const existing = await loadListing(id);
      if (!existing) return res.status(404).json({ success: false, error: "Listing not found" });
      if (isExampleListing(existing)) {
        return res.status(409).json({ success: false, error: "Example listings cannot be marked verified." });
      }
      if (isEvidenceVerified(existing)) {
        return res.json({ success: true, unchanged: true, data: adminView(existing) });
      }
      const verifiedAt = new Date();
      const merged = {
        ...existing,
        evidenceVerified: true,
        verifiedAt,
        verifiedById: req.user.id,
      };
      return await writeListing(existing, {
        evidenceVerified: true,
        verifiedAt,
        verifiedById: req.user.id,
        adminAudit: appendAudit(existing, auditEntry(merged, "verify", req.user.id, null)),
      }, res);
    } catch (error) {
      logger.error("Error verifying listing", {
        code: error.code || error.name,
        message: error.message,
        listingId: id,
      });
      return res.status(500).json({ success: false, error: "We could not record this verification. Try again." });
    }
  }));

  router.post("/:id/unverify", asyncHandler(async (req, res) => {
    const id = parseListingId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid listing ID" });
    try {
      const existing = await loadListing(id);
      if (!existing) return res.status(404).json({ success: false, error: "Listing not found" });
      if (!isEvidenceVerified(existing) && existing.evidenceVerified !== true) {
        return res.json({ success: true, unchanged: true, data: adminView(existing) });
      }
      const merged = {
        ...existing,
        evidenceVerified: false,
        verifiedAt: null,
        verifiedById: null,
      };
      return await writeListing(existing, {
        evidenceVerified: false,
        verifiedAt: null,
        verifiedById: null,
        adminAudit: appendAudit(existing, auditEntry(merged, "unverify", req.user.id, null)),
      }, res);
    } catch (error) {
      logger.error("Error clearing listing verification", {
        code: error.code || error.name,
        message: error.message,
        listingId: id,
      });
      return res.status(500).json({ success: false, error: "We could not clear this verification. Try again." });
    }
  }));

  return router;
}

module.exports = adminListingsRouter;
