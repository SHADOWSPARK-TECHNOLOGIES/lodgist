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

const DIMENSION_LABELS = {
  origin: {
    DIRECT_SUBMISSION: "Direct submission",
    AUTHORIZED_IMPORT: "Authorized import",
    EXTERNAL_REFERENCE: "External reference",
  },
  publication: {
    DRAFT: "Draft",
    REVIEW: "Review",
    PUBLISHED: "Published",
    SUSPENDED: "Suspended",
    REMOVED: "Removed",
  },
  availability: {
    UNKNOWN: "Unknown",
    REPORTED_AVAILABLE: "Reported available",
    RECENTLY_CONFIRMED: "Recently confirmed",
    UNAVAILABLE: "Unavailable",
    EXPIRED: "Expired",
  },
  verification: {
    NOT_CHECKED: "Not checked",
    PENDING: "Pending",
    PARTIALLY_CHECKED: "Partially checked",
    CHECKS_COMPLETED: "Checks completed",
    EXPIRED: "Expired",
    REVOKED: "Revoked",
  },
  locationPrecision: {
    EXACT: "Exact",
    APPROXIMATE: "Approximate",
    UNKNOWN: "Unknown",
  },
  actionEligibility: {
    SOURCE_LINK_ONLY: "Source link only",
    ENQUIRY: "Enquiry",
    VIEWING_REQUEST: "Viewing request",
  },
};

function pickDimension(value, labels) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(labels, value) ? value : null;
}

function derivedPublication(listing) {
  const status = listing && listing.status;
  if (status === "REJECTED" || status === "ARCHIVED") return "REMOVED";
  if (listing && listing.isFlaggedForFraud === true) return "SUSPENDED";
  if (listing && (listing.riskState === "FLAGGED" || listing.riskState === "SUSPENDED")) return "SUSPENDED";
  if (status === "PENDING" || status === "VERIFIED") return "PUBLISHED";
  return "REVIEW";
}

function derivedVerification(listing) {
  if (listing && listing.riskState === "UNDER_REVIEW") return "PENDING";
  return "NOT_CHECKED";
}

function derivedActionEligibility(listing) {
  if (!listing || listing.isFlaggedForFraud === true) return "SOURCE_LINK_ONLY";
  if (listing.status === "VERIFIED") return "VIEWING_REQUEST";
  if (listing.status === "PENDING") return "ENQUIRY";
  return "SOURCE_LINK_ONLY";
}

function listingDimensions(listing) {
  const stored = listing && listing.state;
  if (stored && stored.labels && stored.origin && stored.publication && stored.verification && stored.actionEligibility) {
    return stored;
  }
  const origin = pickDimension(listing && listing.origin, DIMENSION_LABELS.origin) || "DIRECT_SUBMISSION";
  const publication = pickDimension(listing && listing.publication, DIMENSION_LABELS.publication) || derivedPublication(listing);
  const availability = pickDimension(listing && listing.availability, DIMENSION_LABELS.availability) || "UNKNOWN";
  const verification = pickDimension(listing && listing.verification, DIMENSION_LABELS.verification) || derivedVerification(listing);
  const locationPrecision = pickDimension(listing && listing.locationPrecision, DIMENSION_LABELS.locationPrecision) || "UNKNOWN";
  const actionEligibility = pickDimension(listing && listing.actionEligibility, DIMENSION_LABELS.actionEligibility) || derivedActionEligibility(listing);
  return {
    origin,
    publication,
    availability,
    verification,
    locationPrecision,
    actionEligibility,
    labels: {
      origin: DIMENSION_LABELS.origin[origin],
      publication: DIMENSION_LABELS.publication[publication],
      availability: DIMENSION_LABELS.availability[availability],
      verification: DIMENSION_LABELS.verification[verification],
      locationPrecision: DIMENSION_LABELS.locationPrecision[locationPrecision],
      actionEligibility: DIMENSION_LABELS.actionEligibility[actionEligibility],
    },
  };
}

function dimensionRows(listing) {
  const state = listingDimensions(listing);
  return [
    { key: "origin", title: "Origin", value: state.labels.origin },
    { key: "publication", title: "Publication", value: state.labels.publication },
    { key: "availability", title: "Availability", value: state.labels.availability },
    { key: "verification", title: "Verification", value: state.labels.verification },
    { key: "locationPrecision", title: "Location", value: state.labels.locationPrecision },
    { key: "actionEligibility", title: "What you can do", value: state.labels.actionEligibility },
  ];
}

/** Evidence-verified means checks completed, and not a sample or a blocked risk. */
function isEvidenceVerified(listing) {
  if (!listing || typeof listing !== "object") return false;
  if (isExampleListing(listing)) return false;
  if (listing.isFlaggedForFraud === true) return false;
  if (BLOCKED_RISK.has(listing.riskState)) return false;
  return listingDimensions(listing).verification === "CHECKS_COMPLETED";
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
  if (listing && typeof listing.sourceLabel === "string" && listing.sourceLabel.trim()) {
    return listing.sourceLabel.trim();
  }
  return listingDimensions(listing).labels.origin;
}

/** Viewing is open only when action eligibility says so. */
function canRequestViewing(listing) {
  if (!listing || isExampleListing(listing)) return false;
  if (listing.isFlaggedForFraud === true) return false;
  return listingDimensions(listing).actionEligibility === "VIEWING_REQUEST";
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
      ? ["Checks are marked completed. Itemised results are not published."]
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
  listingDimensions,
  dimensionRows,
  verificationLabel,
  sourceLabel,
  canRequestViewing,
  publicListings,
  decisionFacts,
};
