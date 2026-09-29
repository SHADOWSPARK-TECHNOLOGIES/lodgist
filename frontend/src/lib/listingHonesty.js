function isExampleListing(listing) {
  const cost = listing && listing.totalMoveInCost;
  return Boolean(cost && typeof cost === "object" && cost.sample === true);
}

function hasTrustScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isVerifiedListing(listing) {
  return Boolean(listing && listing.status === "VERIFIED");
}

/** Live browse inventory. Samples and anything not VERIFIED stay off the grid. */
function isPublicInventory(listing) {
  return isVerifiedListing(listing) && !isExampleListing(listing);
}

function publicInventory(listings) {
  if (!Array.isArray(listings)) return [];
  return listings.filter(isPublicInventory);
}

/** sample | unavailable | hidden */
function listingBadge(listing) {
  if (!listing || isPublicInventory(listing)) return "hidden";
  if (isExampleListing(listing) || listing.status === "PENDING" || !listing.status) return "sample";
  return "unavailable";
}

module.exports = {
  isExampleListing,
  hasTrustScore,
  isVerifiedListing,
  isPublicInventory,
  publicInventory,
  listingBadge,
};
