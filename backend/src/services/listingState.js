// Listing-state dimensions. Status and riskState stay; they do not stand in
// for verification or availability. Stored enum values win. Missing values
// use the same backfill as migration 20261002223000_listing_state_dimensions.

const ORIGINS = new Set(["DIRECT_SUBMISSION", "AUTHORIZED_IMPORT", "EXTERNAL_REFERENCE"]);
const PUBLICATIONS = new Set(["DRAFT", "REVIEW", "PUBLISHED", "SUSPENDED", "REMOVED"]);
const AVAILABILITIES = new Set(["UNKNOWN", "REPORTED_AVAILABLE", "RECENTLY_CONFIRMED", "UNAVAILABLE", "EXPIRED"]);
const VERIFICATIONS = new Set(["NOT_CHECKED", "PENDING", "PARTIALLY_CHECKED", "CHECKS_COMPLETED", "EXPIRED", "REVOKED"]);
const PRECISIONS = new Set(["EXACT", "APPROXIMATE", "UNKNOWN"]);
const ELIGIBILITIES = new Set(["SOURCE_LINK_ONLY", "ENQUIRY", "VIEWING_REQUEST"]);

const LABELS = {
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

function isSampleListing(listing) {
  const cost = listing && listing.totalMoveInCost;
  return Boolean(cost && typeof cost === "object" && !Array.isArray(cost) && cost.sample === true);
}

function pick(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : null;
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
  // UNDER_REVIEW means a check was started. It is not checks completed.
  // status VERIFIED and riskState VERIFIED are not evidence.
  if (listing && listing.riskState === "UNDER_REVIEW") return "PENDING";
  return "NOT_CHECKED";
}

function derivedActionEligibility(listing) {
  if (!listing || listing.isFlaggedForFraud === true) return "SOURCE_LINK_ONLY";
  if (listing.status === "VERIFIED") return "VIEWING_REQUEST";
  if (listing.status === "PENDING") return "ENQUIRY";
  return "SOURCE_LINK_ONLY";
}

function listingState(listing) {
  const origin = pick(listing && listing.origin, ORIGINS) || "DIRECT_SUBMISSION";
  const publication = pick(listing && listing.publication, PUBLICATIONS) || derivedPublication(listing);
  const availability = pick(listing && listing.availability, AVAILABILITIES) || "UNKNOWN";
  const verification = pick(listing && listing.verification, VERIFICATIONS) || derivedVerification(listing);
  const locationPrecision = pick(listing && listing.locationPrecision, PRECISIONS) || "UNKNOWN";
  const actionEligibility = pick(listing && listing.actionEligibility, ELIGIBILITIES) || derivedActionEligibility(listing);

  return {
    origin,
    publication,
    availability,
    verification,
    locationPrecision,
    actionEligibility,
    labels: {
      origin: LABELS.origin[origin],
      publication: LABELS.publication[publication],
      availability: LABELS.availability[availability],
      verification: LABELS.verification[verification],
      locationPrecision: LABELS.locationPrecision[locationPrecision],
      actionEligibility: LABELS.actionEligibility[actionEligibility],
    },
  };
}

function allowsViewing(listing) {
  if (!listing || isSampleListing(listing)) return false;
  if (listing.isFlaggedForFraud === true) return false;
  return listingState(listing).actionEligibility === "VIEWING_REQUEST";
}

module.exports = {
  LABELS,
  isSampleListing,
  listingState,
  allowsViewing,
  derivedPublication,
  derivedVerification,
  derivedActionEligibility,
};
