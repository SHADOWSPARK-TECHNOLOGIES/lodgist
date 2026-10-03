export type LocationPrecision = "exact" | "approximate" | "unknown";

export interface Campus {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "campus-area";
  provenance: string;
  licence: string;
}

export interface SpatialFocusUnknown {
  precision: "unknown";
  label: string;
}

export interface SpatialFocusApproximate {
  precision: "approximate";
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface SpatialFocusExact {
  precision: "exact";
  fixturePin: true;
  label: string;
  lat: number;
  lng: number;
}

export type SpatialFocus = SpatialFocusUnknown | SpatialFocusApproximate | SpatialFocusExact;

export interface Amenity {
  id: string;
  name: string;
  category: "shop" | "pharmacy" | "clinic" | "transport";
  lat: number;
  lng: number;
  provenance: string;
  fixture: boolean;
}

export interface AmenityPayload {
  status: "ok" | "empty" | "failed" | "unconfigured" | "unavailable";
  items: Amenity[];
  provenance: string | null;
}

export interface RoutePayload {
  status: "ok" | "needs-campus" | "unconfigured" | "failed" | "unavailable";
  distanceM: number | null;
  durationS: number | null;
  origin?: string;
}

export interface PublicSpatialContext {
  fixture: false;
  inventory: "public";
  listingId: number;
  title: string;
  focus: SpatialFocusUnknown | SpatialFocusApproximate;
  disclaimer: string;
  evidenceVerified: false;
  reviewForDisplay: boolean;
  allowExactOrigin: false;
}

export interface PreviewModel {
  fixture: true;
  inventory: "excluded";
  listingId: null;
  title: string;
  focus: SpatialFocus;
  disclaimer: string;
  evidenceVerified: false;
  reviewForDisplay: false;
  allowExactOrigin: boolean;
  enquiry: false;
  amenities: AmenityPayload;
  route: RoutePayload;
  campusId: string | null;
}

export interface ProviderConfig {
  osrmBaseUrl: string | null;
  overpassUrl: string | null;
  tileUrl: string | null;
}

export const DISCLAIMER: string;
export const ROUTING_UNAVAILABLE: string;
export const AMENITY_CATEGORIES: Array<"shop" | "pharmacy" | "clinic" | "transport">;
export const CATEGORY_LABEL: Record<"shop" | "pharmacy" | "clinic" | "transport", string>;
export const CAMPUSES: Campus[];

export function parseCoordinate(lat: unknown, lng: unknown): { lat: number; lng: number } | null;
export function focusFromPublicListing(listing: object): SpatialFocusUnknown | SpatialFocusApproximate;
export function spatialPublicationDecision(listing: object | null): { published: boolean; reason: string };
export function buildPublicSpatialContext(listing: object): PublicSpatialContext | null;
export function straightLineMeters(a: { lat: number; lng: number } | null, b: { lat: number; lng: number } | null): number | null;
export function straightLineLabel(meters: number | null): string | null;
export function externalDirectionsUrl(input: {
  precision: LocationPrecision;
  originLabel?: string;
  originExact?: { lat: number; lng: number } | null;
  allowExactOrigin?: boolean;
  fixturePin?: boolean;
  destination: { name: string; lat: number; lng: number } | null;
}): string | null;
export function urlLeaksCoordinates(url: string | null, coords: Array<{ lat: number; lng: number }>): boolean;
export function readProviderConfig(env?: Record<string, string | undefined>): ProviderConfig;
export function describeRoute(result: RoutePayload): { primary: string; detail: string; distanceM: number | null; durationS: number | null };
export function loadRoute(input: {
  focus: SpatialFocus;
  campus: Campus | null;
  config?: ProviderConfig;
  fetchImpl: typeof fetch;
}): Promise<RoutePayload>;
export function loadAmenities(input: {
  focus: SpatialFocus;
  config?: ProviderConfig;
  fetchImpl: typeof fetch;
  allowFixtures?: boolean;
}): Promise<AmenityPayload>;
export function filterAmenities(items: Amenity[], category: string, allowFixtures: boolean): Amenity[];
export function amenityMessage(status: AmenityPayload["status"]): string | null;
export function mapGeometry(focus: SpatialFocus): { kind: "none" } | { kind: "area"; lat: number; lng: number; radiusM: number } | { kind: "pin"; lat: number; lng: number };
export function buildPreviewModel(scenario?: string, campusId?: string): PreviewModel | null;
export function campusById(id: string | null | undefined): Campus | null;
export function fillTileTemplate(template: string | null, tile: { z: number; x: number; y: number }): string | null;
export function isFixtureRecord(record: object | null): boolean;
