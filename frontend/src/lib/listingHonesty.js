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

/** Default public browse: verified, not an example, and not a non-verified risk state. */
function isPublicListing(listing) {
  if (!listing || typeof listing !== "object") return false;
  if (isExampleListing(listing)) return false;
  if (listing.status !== "VERIFIED") return false;
  if (listing.riskState != null && listing.riskState !== "VERIFIED") return false;
  return true;
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
  const verified = isPublicListing(listing);
  let lastVerification = "Not verified. No verification date is on file.";
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
  isExampleListing,
  hasTrustScore,
  isPublicListing,
  publicListings,
  decisionFacts,
};
