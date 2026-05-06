/**
 * tenancyAgreementService.js
 *
 * Section 84 Contract Workflow for Lodgist.
 * Handles SHA-256 hashing, IP audit logging, and certificate generation
 * for tenancy agreements under Nigerian law.
 *
 * @module tenancyAgreementService
 */

const crypto = require("crypto");

// ── Constants ──────────────────────────────────────────────────────────────

const AGREEMENT_VERSION = "1.0.0";
const JURISDICTION = "Nigeria";
const GOVERNING_LAW = "Constitution of the Federal Republic of Nigeria 1999 (as amended)";

// ── Hashing ────────────────────────────────────────────────────────────────

/**
 * Generate a SHA-256 hash of an agreement document.
 *
 * @param {string} content - The full text content of the agreement
 * @returns {{ hash: string, algorithm: string, timestamp: string }}
 */
function hashAgreement(content) {
  if (!content || typeof content !== "string") {
    throw new Error("Agreement content is required and must be a string");
  }

  const hash = crypto.createHash("sha256").update(content, "utf-8").digest("hex");

  return {
    hash,
    algorithm: "SHA-256",
    timestamp: new Date().toISOString(),
  };
}

// ── IP Audit Logging ───────────────────────────────────────────────────────

/**
 * Create an audit log entry for an agreement action.
 *
 * @param {object} params
 * @param {string} params.action - The action performed (e.g., "CREATED", "SIGNED", "VIEWED")
 * @param {number} params.agreementId - The agreement identifier
 * @param {number} params.userId - The user who performed the action
 * @param {string} params.ipAddress - The IP address of the user
 * @param {string} [params.userAgent] - The user agent string
 * @param {object} [params.metadata] - Additional metadata
 * @returns {object}
 */
function createAuditLog({ action, agreementId, userId, ipAddress, userAgent, metadata }) {
  if (!action) throw new Error("action is required");
  if (!agreementId) throw new Error("agreementId is required");
  if (!userId) throw new Error("userId is required");
  if (!ipAddress) throw new Error("ipAddress is required");

  return {
    id: crypto.randomUUID(),
    action,
    agreement_id: agreementId,
    user_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent || "unknown",
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
    signature: crypto
      .createHash("sha256")
      .update(`${action}:${agreementId}:${userId}:${ipAddress}:${Date.now()}`)
      .digest("hex")
      .substring(0, 16),
  };
}

// ── Certificate Generation ─────────────────────────────────────────────────

/**
 * Generate a completion certificate for a signed tenancy agreement.
 *
 * @param {object} params
 * @param {number} params.agreementId - The agreement identifier
 * @param {string} params.tenantName - Full name of the tenant
 * @param {string} params.landlordName - Full name of the landlord
 * @param {string} params.propertyAddress - Address of the property
 * @param {number} params.rentAmount - Annual rent amount
 * @param {string} params.currency - Currency code (e.g., "NGN")
 * @param {Date} params.startDate - Tenancy start date
 * @param {Date} params.endDate - Tenancy end date
 * @param {string} params.agreementHash - SHA-256 hash of the agreement
 * @returns {object}
 */
function generateCertificate({
  agreementId,
  tenantName,
  landlordName,
  propertyAddress,
  rentAmount,
  currency = "NGN",
  startDate,
  endDate,
  agreementHash,
}) {
  if (!agreementId) throw new Error("agreementId is required");
  if (!tenantName) throw new Error("tenantName is required");
  if (!landlordName) throw new Error("landlordName is required");
  if (!propertyAddress) throw new Error("propertyAddress is required");
  if (!rentAmount) throw new Error("rentAmount is required");
  if (!startDate) throw new Error("startDate is required");
  if (!endDate) throw new Error("endDate is required");
  if (!agreementHash) throw new Error("agreementHash is required");

  const certificateId = `LODGIST-CERT-${agreementId}-${Date.now()}`;
  const issuedAt = new Date().toISOString();

  // Generate a verification token
  const verificationToken = crypto
    .createHash("sha256")
    .update(`${certificateId}:${agreementHash}:${issuedAt}`)
    .digest("hex");

  return {
    certificate_id: certificateId,
    version: AGREEMENT_VERSION,
    jurisdiction: JURISDICTION,
    governing_law: GOVERNING_LAW,
    issued_at: issuedAt,
    parties: {
      tenant: tenantName,
      landlord: landlordName,
    },
    property: {
      address: propertyAddress,
    },
    tenancy: {
      rent_amount: rentAmount,
      currency,
      start_date: startDate instanceof Date ? startDate.toISOString() : startDate,
      end_date: endDate instanceof Date ? endDate.toISOString() : endDate,
      duration_months: Math.round(
        ((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30))
      ),
    },
    agreement_hash: agreementHash,
    verification_token: verificationToken,
    status: "ACTIVE",
    certificate_url: `/api/agreements/${agreementId}/certificate`,
  };
}

// ── Agreement Template ─────────────────────────────────────────────────────

/**
 * Generate a standard tenancy agreement text based on Section 84 principles.
 *
 * @param {object} params
 * @returns {string} The full agreement text
 */
function generateAgreementText(params) {
  const {
    tenantName,
    landlordName,
    landlordAddress,
    propertyAddress,
    rentAmount,
    currency = "NGN",
    depositAmount,
    startDate,
    endDate,
    utilitiesIncluded = false,
    specialClauses = [],
  } = params;

  const date = new Date().toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const clauses = [
    `1. PARTIES: This Tenancy Agreement is made on ${date} between ${landlordName} of ${landlordAddress || "[Landlord's Address]"} (hereinafter called "the Landlord") AND ${tenantName} (hereinafter called "the Tenant").`,
    ``,
    `2. PROPERTY: The Landlord agrees to let and the Tenant agrees to take the property known as ${propertyAddress} (hereinafter called "the Premises").`,
    ``,
    `3. TERM: The tenancy shall commence on ${new Date(startDate).toLocaleDateString("en-NG")} and shall continue until ${new Date(endDate).toLocaleDateString("en-NG")} (the "Term").`,
    ``,
    `4. RENT: The Tenant shall pay rent of ${currency} ${Number(rentAmount).toLocaleString()} per annum, payable in advance on the first day of each rental period.`,
    ``,
    `5. DEPOSIT: The Tenant shall pay a deposit of ${currency} ${Number(depositAmount || 0).toLocaleString()} to be held as security against breach of covenant.`,
    ``,
    `6. USE OF PREMISES: The Premises shall be used solely as a private residence and for no other purpose.`,
    ``,
    `7. MAINTENANCE: The Landlord shall be responsible for structural repairs. The Tenant shall be responsible for day-to-day maintenance.`,
    ``,
    `8. UTILITIES: ${utilitiesIncluded ? "Utility bills (electricity, water, and waste disposal) are included in the rent." : "The Tenant shall be responsible for all utility bills (electricity, water, and waste disposal)."}`,
    ``,
    `9. INSPECTION: The Landlord or their agent may inspect the Premises at reasonable hours upon giving 48 hours' notice.`,
    ``,
    `10. GOVERNING LAW: This Agreement shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria.`,
    ``,
    `11. DISPUTE RESOLUTION: Any dispute arising out of this Agreement shall first be referred to mediation before any legal proceedings are commenced.`,
    ``,
    `12. NOTICE: Any notice required under this Agreement shall be in writing and served personally or by email to the last known address of the recipient.`,
  ];

  if (specialClauses.length > 0) {
    clauses.push(``);
    clauses.push(`13. SPECIAL CLAUSES:`);
    specialClauses.forEach((clause, i) => {
      clauses.push(`    ${13 + i + 1}. ${clause}`);
    });
  }

  clauses.push(``);
  clauses.push(`IN WITNESS WHEREOF the parties have executed this Agreement on the date first above written.`);
  clauses.push(``);
  clauses.push(`SIGNED by the LANDLORD: ___________________________`);
  clauses.push(`Date: _______________`);
  clauses.push(``);
  clauses.push(`SIGNED by the TENANT: ___________________________`);
  clauses.push(`Date: _______________`);

  return clauses.join("\n");
}

module.exports = {
  hashAgreement,
  createAuditLog,
  generateCertificate,
  generateAgreementText,
  AGREEMENT_VERSION,
  JURISDICTION,
  GOVERNING_LAW,
};
