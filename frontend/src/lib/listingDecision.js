const { isExampleListing } = require("./listingHonesty");

const UNVERIFIED_CHECKS = [
  "Title document — not done",
  "Landlord identity — not done",
  "Physical inspection — not done",
  "Price against nearby homes — not done",
  "Disputes on record — not done",
  "Legal consent — not done",
];

function money(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function moveInTotal(listing) {
  const cost = listing && listing.totalMoveInCost;
  if (!cost || typeof cost !== "object" || Array.isArray(cost)) return null;
  return money(cost.total);
}

function whatsAppLink(envValue, text) {
  if (typeof envValue !== "string") return null;
  const digits = envValue.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  const base = `https://wa.me/${digits}`;
  if (text == null || text === "") return base;
  return `${base}?text=${encodeURIComponent(String(text))}`;
}

/**
 * Fields the decision page can show from the public listing payload.
 * It does not invent a verification date or a passed-check list.
 */
function buildDecision(listing) {
  const sampleCost = isExampleListing(listing);
  const verified = Boolean(listing && listing.status === "VERIFIED" && !sampleCost);
  return {
    verified,
    sample: !verified,
    annualRent: listing ? money(listing.price) : null,
    moveInTotal: moveInTotal(listing),
    moveInIsExample: !verified,
    lastVerificationText: verified
      ? "Marked verified. The date of the last check is not published."
      : "No verification on record.",
    checksDoneText: verified
      ? "This listing is marked verified. Individual checks are not published on this page."
      : "None. This listing has not been verified.",
    checksOutstanding: verified
      ? ["Physical inspection — walk the house before you pay."]
      : UNVERIFIED_CHECKS.slice(),
  };
}

module.exports = { buildDecision, whatsAppLink };
