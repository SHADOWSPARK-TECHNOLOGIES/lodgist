/**
 * agreements.js
 *
 * Section 84 Tenancy Agreement routes for Lodgist.
 * Handles CRUD operations, signing workflow, and certificate generation.
 *
 * @module routes/agreements
 */

const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  hashAgreement,
  createAuditLog,
  generateCertificate,
  generateAgreementText,
} = require("../services/tenancyAgreementService");

// In-memory store (replace with DB in production)
const agreements = new Map();
let nextId = 1;

const NOT_FOUND = { error: "Agreement not found" };

function sameUser(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function isParty(agreement, user) {
  return Boolean(user) && (
    sameUser(agreement.tenantUserId, user.id) ||
    sameUser(agreement.landlordUserId, user.id) ||
    sameUser(agreement.createdByUserId, user.id)
  );
}

/**
 * Load an agreement the caller may read: a party to it (tenant, landlord,
 * creator) or STUDIO_ADMIN. Anyone else gets the same 404 as a missing id,
 * so the endpoint does not confirm that an agreement exists.
 */
function loadReadable(req, res) {
  const agreement = agreements.get(parseInt(req.params.id, 10));
  if (!agreement || !(isParty(agreement, req.user) || req.user?.role === "STUDIO_ADMIN")) {
    res.status(404).json(NOT_FOUND);
    return null;
  }
  return agreement;
}

// POST /api/agreements
// Create a new tenancy agreement
router.post("/", requireAuth, (req, res) => {
  try {
    const {
      tenantName,
      landlordName,
      landlordAddress,
      propertyAddress,
      rentAmount,
      currency,
      depositAmount,
      startDate,
      endDate,
      utilitiesIncluded,
      specialClauses,
      tenantUserId,
      landlordUserId,
    } = req.body;

    if (!tenantName || !landlordName || !propertyAddress || !rentAmount || !startDate || !endDate) {
      return res.status(400).json({
        error: "Missing required fields: tenantName, landlordName, propertyAddress, rentAmount, startDate, endDate",
      });
    }

    // Bind the creator to one side; the other side is bound by user id from the body.
    let boundTenant = tenantUserId ?? null;
    let boundLandlord = landlordUserId ?? null;
    if (!sameUser(boundTenant, req.user.id) && !sameUser(boundLandlord, req.user.id)) {
      if (req.user.role === "LANDLORD" && boundLandlord == null) boundLandlord = req.user.id;
      else if (boundTenant == null) boundTenant = req.user.id;
      else if (boundLandlord == null) boundLandlord = req.user.id;
    }

    const id = nextId++;
    const agreementText = generateAgreementText({
      tenantName,
      landlordName,
      landlordAddress,
      propertyAddress,
      rentAmount,
      currency: currency || "NGN",
      depositAmount,
      startDate,
      endDate,
      utilitiesIncluded,
      specialClauses,
    });

    const hashed = hashAgreement(agreementText);

    const agreement = {
      id,
      createdByUserId: req.user.id,
      tenantUserId: boundTenant,
      landlordUserId: boundLandlord,
      tenantName,
      landlordName,
      propertyAddress,
      rentAmount,
      currency: currency || "NGN",
      depositAmount: depositAmount || 0,
      startDate,
      endDate,
      utilitiesIncluded: utilitiesIncluded || false,
      specialClauses: specialClauses || [],
      agreementText,
      hash: hashed.hash,
      hashAlgorithm: hashed.algorithm,
      status: "DRAFT",
      tenantSigned: false,
      landlordSigned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    agreements.set(id, agreement);

    res.status(201).json({
      id,
      status: agreement.status,
      hash: agreement.hash,
      message: "Agreement created successfully",
    });
  } catch (err) {
    console.error("Error creating agreement:", err.message);
    res.status(500).json({ error: "Failed to create agreement", details: err.message });
  }
});

// GET /api/agreements/:id
// Get agreement details
router.get("/:id", requireAuth, (req, res) => {
  const agreement = loadReadable(req, res);
  if (!agreement) return;

  res.json(agreement);
});

// POST /api/agreements/:id/sign
// Sign an agreement (tenant or landlord)
router.post("/:id/sign", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const agreement = agreements.get(id);

    // Only a party may sign; everyone else (admin included) cannot see it here.
    if (!agreement || !isParty(agreement, req.user)) {
      return res.status(404).json(NOT_FOUND);
    }

    const { party, ipAddress, userAgent } = req.body;

    if (!party || !["tenant", "landlord"].includes(party)) {
      return res.status(400).json({ error: "party must be 'tenant' or 'landlord'" });
    }

    const boundUserId = party === "tenant" ? agreement.tenantUserId : agreement.landlordUserId;
    if (!sameUser(boundUserId, req.user.id)) {
      return res.status(403).json({ error: `Only the ${party} on this agreement can sign as ${party}` });
    }

    if (party === "tenant") {
      if (agreement.tenantSigned) {
        return res.status(409).json({ error: "Tenant has already signed" });
      }
      agreement.tenantSigned = true;
    } else {
      if (agreement.landlordSigned) {
        return res.status(409).json({ error: "Landlord has already signed" });
      }
      agreement.landlordSigned = true;
    }

    // Create audit log
    const audit = createAuditLog({
      action: "SIGNED",
      agreementId: id,
      userId: req.user.id,
      ipAddress: ipAddress || req.ip,
      userAgent,
      metadata: { party },
    });

    // Check if both parties have signed
    if (agreement.tenantSigned && agreement.landlordSigned) {
      agreement.status = "EXECUTED";

      // Generate certificate
      const certificate = generateCertificate({
        agreementId: id,
        tenantName: agreement.tenantName,
        landlordName: agreement.landlordName,
        propertyAddress: agreement.propertyAddress,
        rentAmount: agreement.rentAmount,
        currency: agreement.currency,
        startDate: agreement.startDate,
        endDate: agreement.endDate,
        agreementHash: agreement.hash,
      });

      agreement.certificate = certificate;
    }

    agreement.updatedAt = new Date().toISOString();

    res.json({
      id,
      status: agreement.status,
      tenantSigned: agreement.tenantSigned,
      landlordSigned: agreement.landlordSigned,
      audit,
      certificate: agreement.certificate || null,
    });
  } catch (err) {
    console.error("Error signing agreement:", err.message);
    res.status(500).json({ error: "Failed to sign agreement", details: err.message });
  }
});

// GET /api/agreements/:id/certificate
// Get the completion certificate for a signed agreement
router.get("/:id/certificate", requireAuth, (req, res) => {
  const agreement = loadReadable(req, res);
  if (!agreement) return;

  if (agreement.status !== "EXECUTED" || !agreement.certificate) {
    return res.status(400).json({
      error: "Certificate not available. Agreement must be signed by both parties first.",
    });
  }

  res.json(agreement.certificate);
});

// GET /api/agreements
// List all agreements
router.get("/", requireAuth, requireRole("STUDIO_ADMIN"), (_req, res) => {
  const list = Array.from(agreements.values()).map((a) => ({
    id: a.id,
    status: a.status,
    tenantName: a.tenantName,
    landlordName: a.landlordName,
    propertyAddress: a.propertyAddress,
    createdAt: a.createdAt,
  }));

  res.json(list);
});

module.exports = router;
