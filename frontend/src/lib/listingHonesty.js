const OUTSTANDING_CHECKS = [
  "Title document",
  "Landlord identity",
  "Price against nearby homes",
  "Disputes on record",
  "Legal consent",
  "Physical inspection",
];

function isExampleListing(listing) {
  const cost = listing && listing.totalMoveInCost;
  return Boolean(cost && typeof cost === "object" && cost.sample === true);
}

function hasTrustScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

const NOT_VERIFIED_LABEL = "Not verified by Lodgist";
const VERIFIED_LABEL = "Verified by Lodgist";
const DIRECT_SOURCE_LABEL = "Direct submission";
const BLOCKED_RISK = new Set(["FLAGGED", "SUSPENDED"]);

/** Evidence-verified means status VERIFIED with a verified or unscored risk, and not a sample. */
function isEvidenceVerified(listing) {
  if (!listing || typeof listing !== "object") return false;
  if (isExampleListing(listing)) return false;
  if (listing.isFlaggedForFraud === true) return false;
  if (listing.status !== "VERIFIED") return false;
  if (BLOCKED_RISK.has(listing.riskState)) return false;
  if (listing.riskState === "UNVERIFIED" || listing.riskState === "UNDER_REVIEW") return false;
  return listing.riskState == null || listing.riskState === "VERIFIED";
}

/** Public discovery: non-sample PENDING or VERIFIED, and not fraud / flagged / suspended. */
function isPublicListing(listing) {
  if (!listing || typeof listing !== "object") return false;
  if (isExampleListing(listing)) return false;
  if (listing.isFlaggedForFraud === true) return false;
  if (listing.status !== "PENDING" && listing.status !== "VERIFIED") return false;
  if (BLOCKED_RISK.has(listing.riskState)) return false;
  return true;
}

function verificationLabel(listing) {
  return isEvidenceVerified(listing) ? VERIFIED_LABEL : NOT_VERIFIED_LABEL;
}

function sourceLabel(listing) {
  const channel = listing && (listing.source || listing.sourceChannel);
  if (typeof channel === "string" && channel.trim()) return channel.trim();
  if (listing && typeof listing.sourceLabel === "string" && listing.sourceLabel.trim()) {
    return listing.sourceLabel.trim();
  }
  return DIRECT_SOURCE_LABEL;
}

/** Same gate as POST viewing-requests: status VERIFIED and not fraud-flagged. */
function canRequestViewing(listing) {
  if (!listing || isExampleListing(listing)) return false;
  return listing.status === "VERIFIED" && listing.isFlaggedForFraud !== true;
}

function publicListings(listings) {
  if (!Array.isArray(listings)) return [];
  return listings.filter(isPublicListing);
}

function moveInTotal(listing) {
  const cost = listing && listing.totalMoveInCost;
  if (!cost || typeof cost !== "object" || Array.isArray(cost)) return null;
  const total = cost.total;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

function decisionFacts(listing) {
  const example = isExampleListing(listing);
  const verified = isEvidenceVerified(listing);
  let lastVerification = "Not verified by Lodgist. No verification date is on file.";
  if (example) lastVerification = "Example only. This home has not been checked.";
  else if (verified) lastVerification = "Verified. The verification date is not published on this listing.";

  return {
    example,
    verified,
    annualRent: listing && typeof listing.price === "number" && Number.isFinite(listing.price) ? listing.price : null,
    moveInTotal: moveInTotal(listing),
    lastVerification,
    completed: verified
      ? ["Listing status is verified. Itemised check results are not published."]
      : [],
    outstanding: verified ? ["Physical inspection before you pay"] : OUTSTANDING_CHECKS.slice(),
  };
}

module.exports = {
  OUTSTANDING_CHECKS,
  NOT_VERIFIED_LABEL,
  VERIFIED_LABEL,
  DIRECT_SOURCE_LABEL,
  isExampleListing,
  hasTrustScore,
  isEvidenceVerified,
  isPublicListing,
  verificationLabel,
  sourceLabel,
  canRequestViewing,
  publicListings,
  decisionFacts,
};
