const {
  AMENITY_CATEGORIES,
  CATEGORY_LABEL,
  CAMPUSES,
  DISCLAIMER,
  amenityMessage,
  filterAmenities,
  straightLineMeters,
  mapGeometry,
  buildPreviewModel,
  campusById,
  configureSpatialCore,
  buildPublicSpatialContext: coreBuildPublicSpatialContext,
  focusFromPublicListing: coreFocusFromPublicListing,
  parseCoordinate,
  spatialPublicationDecision,
  straightLineLabel: coreStraightLineLabel,
  describeRoute: coreDescribeRoute,
} = require("@lodgist/spatial-core");
const { isPublicListing } = require("./listingHonesty");

configureSpatialCore({ isPublicListing });

function focusFromPublicListing(listing) {
  const focus = coreFocusFromPublicListing(listing);
  if (focus && focus.precision === "approximate") return focus;
  const label = focus && typeof focus.label === "string" && focus.label.trim()
    ? focus.label
    : "Location not published";
  return { precision: "unknown", label };
}

function buildPublicSpatialContext(listing) {
  const context = coreBuildPublicSpatialContext(listing);
  if (!context) return null;
  const focus = focusFromPublicListing(listing);
  const rest = Object.assign({}, context);
  delete rest.locationState;
  return Object.assign(rest, { focus });
}

function externalDirectionsUrl(input) {
  const destination = input && input.destination;
  const dest = destination && parseCoordinate(destination.lat, destination.lng);
  if (!dest || !destination.name) return null;
  const exact = input.originExact && parseCoordinate(input.originExact.lat, input.originExact.lng);
  const allowExact = input.allowExactOrigin === true && input.precision === "exact" && input.fixturePin === true && exact;
  if (allowExact) {
    return `https://www.google.com/maps/dir/?api=1&origin=${exact.lat},${exact.lng}&destination=${encodeURIComponent(destination.name)}`;
  }
  const label = typeof input.originLabel === "string" ? input.originLabel.trim() : "";
  const origin = label ? `&origin=${encodeURIComponent(label)}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(destination.name)}`;
}

function straightLineLabel(meters) {
  const label = coreStraightLineLabel(meters);
  if (!label) return null;
  return `${label} to campus center`;
}

function describeRoute(result) {
  const copy = coreDescribeRoute(result);
  if (!result || result.status !== "ok") return copy;
  return {
    primary: `${copy.primary} The road route ends at the campus area center, not an entrance.`,
    detail: "This time comes from the routing provider. It is not a route to a campus entrance.",
    distanceM: copy.distanceM,
    durationS: copy.durationS,
  };
}

module.exports = {
  AMENITY_CATEGORIES,
  CATEGORY_LABEL,
  CAMPUSES,
  DISCLAIMER,
  amenityMessage,
  filterAmenities,
  straightLineMeters,
  mapGeometry,
  buildPreviewModel,
  campusById,
  buildPublicSpatialContext,
  focusFromPublicListing,
  spatialPublicationDecision,
  straightLineLabel,
  describeRoute,
  externalDirectionsUrl,
};
