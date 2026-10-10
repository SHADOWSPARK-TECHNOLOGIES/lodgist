export {
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
} from "@lodgist/spatial-core";

import type { LocationPrecision, PublicSpatialContext, RoutePayload, SpatialFocus } from "@lodgist/spatial-core";

export function buildPublicSpatialContext(listing: object): PublicSpatialContext | null;
export function focusFromPublicListing(listing: object): SpatialFocus;
export function spatialPublicationDecision(listing: object | null): { published: boolean; reason: string };
export function externalDirectionsUrl(input: {
  precision: LocationPrecision;
  originLabel?: string;
  originExact?: { lat: number; lng: number } | null;
  allowExactOrigin?: boolean;
  fixturePin?: boolean;
  destination: { name: string; lat: number; lng: number } | null;
}): string | null;
export function straightLineLabel(meters: number | null): string | null;
export function describeRoute(result: RoutePayload): {
  primary: string;
  detail: string;
  distanceM: number | null;
  durationS: number | null;
};
