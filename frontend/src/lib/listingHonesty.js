function isExampleListing(listing) {
  const cost = listing && listing.totalMoveInCost;
  return Boolean(cost && typeof cost === "object" && cost.sample === true);
}

function hasTrustScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

module.exports = { isExampleListing, hasTrustScore };
