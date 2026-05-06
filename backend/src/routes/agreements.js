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
const {
  hashAgreement,
  createAuditLog,
  generateCertificate,
  generateAgreementText,
} = require("../services/tenancyAgreementService");

// In-memory store (replace with DB in production)
const agreements = new Map();
let nextId = 1;

// POST /api/agreements
// Create a new tenancy agreement
router.post("/", (req, res) => {
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
    } = req.body;

    if (!tenantName || !landlordName || !propertyAddress || !rentAmount || !startDate || !endDate) {
      return res.status(400).json({
        error: "Missing required fields: tenantName, landlordName, propertyAddress, rentAmount, startDate, endDate",
      });
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
router.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const agreement = agreements.get(id);

  if (!agreement) {
    return res.status(404).json({ error: "Agreement not found" });
  }

  res.json(agreement);
});

// POST /api/agreements/:id/sign
// Sign an agreement (tenant or landlord)
router.post("/:id/sign", (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const agreement = agreements.get(id);

    if (!agreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    const { party, ipAddress, userAgent } = req.body;

    if (!party || !["tenant", "landlord"].includes(party)) {
      return res.status(400).json({ error: "party must be 'tenant' or 'landlord'" });
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
      userId: party === "tenant" ? 1 : 2, // Replace with actual user ID
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
router.get("/:id/certificate", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const agreement = agreements.get(id);

  if (!agreement) {
    return res.status(404).json({ error: "Agreement not found" });
  }

  if (agreement.status !== "EXECUTED" || !agreement.certificate) {
    return res.status(400).json({
      error: "Certificate not available. Agreement must be signed by both parties first.",
    });
  }

  res.json(agreement.certificate);
});

// GET /api/agreements
// List all agreements
router.get("/", (_req, res) => {
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
