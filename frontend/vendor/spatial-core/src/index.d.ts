export type LocationPrecision = "exact" | "approximate" | "area-only" | "unknown";

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

export interface SpatialFocusAreaOnly {
  precision: "area-only";
  label: string;
}

export interface SpatialFocusExact {
  precision: "exact";
  fixturePin: true;
  label: string;
  lat: number;
  lng: number;
}

export type SpatialFocus = SpatialFocusUnknown | SpatialFocusAreaOnly | SpatialFocusApproximate | SpatialFocusExact;

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
  focus: SpatialFocusUnknown | SpatialFocusAreaOnly | SpatialFocusApproximate;
  disclaimer: string;
  evidenceVerified: false;
  reviewForDisplay: boolean;
  allowExactOrigin: false;
  locationState: "approximate" | "area-only" | "unknown";
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
  attribution: string | null;
}

export type DataSourceStatus = "cleared" | "under review" | "not connected" | "rejected" | "absent";

export interface DataSourceRow {
  id: string;
  status: string;
  env?: string;
  license?: string | null;
  termsUrl?: string | null;
  termsCheckedAt?: string | null;
}

export interface ProviderGate {
  id: string;
  status: DataSourceStatus | string;
  cleared: boolean;
}

export interface SafeguardState {
  cache: Map<string, { storedAt: number; value: unknown }>;
  tails: Map<string, Promise<void>>;
  backoffUntil: Map<string, number>;
  budget: Map<string, number>;
}

export interface ProviderCallOptions {
  env?: Record<string, string | undefined>;
  registry?: DataSourceRow[];
  safeguardState?: SafeguardState;
  now?: () => number;
  ttlMs?: number;
  budgetLimit?: number | null;
}

export const DISCLAIMER: string;
export const ROUTING_UNAVAILABLE: string;
export const AMENITY_CATEGORIES: Array<"shop" | "pharmacy" | "clinic" | "transport">;
export const CATEGORY_LABEL: Record<"shop" | "pharmacy" | "clinic" | "transport", string>;
export const CAMPUSES: Campus[];
export const PRIVATE_LOCATION_KEYS: ReadonlySet<string>;
export const ALLOWED_LAYERS: readonly string[];
export const BANNED_LAYERS: readonly string[];
export const DATA_SOURCE_REVISION: string;
export const DEFAULT_CACHE_TTL_MS: number;
export const DEFAULT_DAILY_BUDGET: number;
export function cachePermitted(providerId: string, cachePolicy?: string): boolean;
export const PROVIDER_BACKOFF_MS: number;
export const DEFAULT_USER_AGENT: string;

export function parseCoordinate(lat: unknown, lng: unknown): { lat: number; lng: number } | null;
export function focusFromPublicListing(listing: object): SpatialFocusUnknown | SpatialFocusAreaOnly | SpatialFocusApproximate;
export function exactPinPermitted(focus: object | null, allowExactOrigin?: boolean): boolean;
export function spatialPublicationDecision(listing: object | null): { published: boolean; reason: string };
export function buildPublicSpatialContext(listing: object): PublicSpatialContext | null;
export function adaptSpatialListing(input: object | null): {
  id: number;
  purpose: string;
  category: string | null;
  publicationStatus: "public";
  locationState: "approximate" | "area-only" | "unknown";
  publicLocation: SpatialFocusUnknown | SpatialFocusAreaOnly | SpatialFocusApproximate;
} | null;
export function anonymousListingRequest(apiBase: string, id: string): {
  url: string;
  init: { cache: "no-store"; headers: { Accept: string } };
};
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
} & ProviderCallOptions): Promise<RoutePayload>;
export function loadAmenities(input: {
  focus: SpatialFocus;
  config?: ProviderConfig;
  fetchImpl: typeof fetch;
  allowFixtures?: boolean;
} & ProviderCallOptions): Promise<AmenityPayload>;
export function filterAmenities(items: Amenity[], category: string, allowFixtures: boolean): Amenity[];
export function amenityMessage(status: AmenityPayload["status"]): string | null;
export function mapGeometry(focus: SpatialFocus): { kind: "none" } | { kind: "area"; lat: number; lng: number; radiusM: number } | { kind: "pin"; lat: number; lng: number };
export function buildPreviewModel(scenario?: string, campusId?: string): PreviewModel | null;
export function campusById(id: string | null | undefined): Campus | null;
export function fillTileTemplate(template: string | null, tile: { z: number; x: number; y: number }): string | null;
export function publicTileTemplate(env?: Record<string, string | undefined>): string | null;
export function publicSubject(value?: string | null): string;
export function focusableElements(root: ParentNode | null): HTMLElement[];
export function nextDialogFocus(elements: HTMLElement[], current: EventTarget | null, backwards: boolean): HTMLElement | null;
export function isFixtureRecord(record: object | null): boolean;
export function configureSpatialCore(options: { isPublicListing?: (listing: object | null) => boolean }): void;
export function assertLayerId(id: string): string;
export function dataSources(registry?: DataSourceRow[]): DataSourceRow[];
export function providerGate(id: string, registry?: DataSourceRow[]): ProviderGate;

export type CommercialUse = "APPROVED_COMMERCIAL" | "APPROVED_WITH_ATTRIBUTION" | "DEVELOPMENT_ONLY" | "NON_COMMERCIAL" | "UNKNOWN";

export interface RegistryProvider extends DataSourceRow {
  category: string;
  capabilities: string[];
  commercialUse: CommercialUse;
  authentication: { required: boolean; env?: string };
  attribution: string | null;
  license: string | null;
  termsUrl: string | null;
  termsCheckedAt: string | null;
  cachePolicy: string;
  health: string;
  fallbackPriority: number;
}

export const COMMERCIAL_CLASSES: readonly CommercialUse[];
export const PROVIDER_CATEGORIES: readonly string[];
export function providerRegistry(registry?: DataSourceRow[]): RegistryProvider[];
export function providerCanRun(id: string, options?: {
  registry?: DataSourceRow[];
  env?: Record<string, string | undefined>;
  production?: boolean;
}): { ok: boolean; code: string; row: RegistryProvider | null };
export function providerFallback(category: string, options?: {
  registry?: DataSourceRow[];
  env?: Record<string, string | undefined>;
  production?: boolean;
}): RegistryProvider[];
export function refuseUserSuppliedProviderUrl(input: object | null): void;
export function cellKey(focus: SpatialFocus, categories?: string[]): string;
export function stripPrivateLocationKeys<T>(value: T): T;
export function assertNoPrivateLocationKeys<T>(value: T): T;
export function createSafeguardState(): SafeguardState;

export type SpatialClassification = "VERIFIED" | "OBSERVED" | "DERIVED" | "ESTIMATED" | "UNKNOWN";
export type SpatialFreshness = "fresh" | "stale" | "unknown";

export interface SpatialObservation {
  subjectId: string | null;
  provider: string | null;
  kind: string;
  fact: string;
  value: unknown;
  observedAt: number | null;
  retrievedAt: number | null;
  freshness: SpatialFreshness;
  confidence: number | null;
  classification: SpatialClassification;
  attribution: string | null;
  license: string | null;
  coverage: string | null;
  source: string | null;
}

export interface CrossReferenceReport {
  observations: SpatialObservation[];
  agreements: Array<{ subjectId: string | null; fact: string; values: unknown[] }>;
  conflicts: Array<{ subjectId: string | null; fact: string; values: unknown[] }>;
  missing: Array<{ provider: string | null; subjectId: string | null; fact: string | null; reason: string }>;
  freshness: SpatialFreshness;
  provenance: Array<{ provider: string | null; source: string | null; license: string | null; retrievedAt: number | null }>;
  coverage: Array<string | null>;
}

export const CLASSIFICATIONS: readonly SpatialClassification[];
export const CANONICAL_CATEGORIES: readonly Array<"shop" | "pharmacy" | "clinic" | "transport">;
export const LAB_LAYER_TO_CATEGORY: Readonly<Record<string, "shop" | "pharmacy" | "clinic" | "transport" | null>>;
export const TRANSIT_POLICY: { id: "transit"; status: "undecided"; enabled: false; reason: string };
export const SPATIAL_LAB_CONTRACT: {
  revision: string;
  allowedLayers: string[];
  bannedLayers: string[];
  amenityCategories: string[];
  providerIds: string[];
  transit: string;
};

export function crossReference(input: {
  location?: { listingId?: number | string; campusId?: string | null };
  subjects?: Array<number | string>;
  providers?: Array<{ id?: string; observations?: object[] }>;
  constraints?: { requiredFacts?: string[] };
  now?: number;
  staleAfterMs?: number;
}): CrossReferenceReport;
export function relateListingToCampus(input: {
  listingId: number | string;
  campusId: string;
  listings?: object[];
  isPublicListing?: (listing: object | null) => boolean;
}): {
  listingId: number | string;
  campusId: string;
  campusName?: string | null;
  status: string;
  straightLineLabel: string | null;
  travelTime: null;
};
export type CoverageGrade = "GOOD" | "PARTIAL" | "POOR" | "UNKNOWN";
export type ComparisonConfidence = "supported" | "limited" | "low" | "unknown";
export const COVERAGE_GRADES: readonly CoverageGrade[];
export const INCOMPLETE_WARNING: string;
export function assessPlaceCoverage(input?: {
  campusId?: string | null;
  label?: string | null;
  title?: string | null;
}): {
  coverage: CoverageGrade;
  warnings: string[];
  analystNote: string;
  benchmarkId: string | null;
  locationStatus: "verified" | "unverified" | "unmatched";
  source: string;
  groundTruth: false;
};
export function weakestCoverage(grades?: string[]): CoverageGrade;
export function comparisonConfidence(grades?: string[]): ComparisonConfidence;
export function compareListings(input: {
  listingIds: Array<number | string>;
  listings?: object[];
  isPublicListing?: (listing: object | null) => boolean;
}): {
  listingIds: Array<number | string>;
  comparisons: Array<{ fact: string; values: Record<string, unknown>; agreement: boolean }>;
  coverage: CoverageGrade;
  comparisonConfidence: ComparisonConfidence;
  warnings: string[];
  analystNote: string;
};
export function mapLabLayer(layerId: string): "shop" | "pharmacy" | "clinic" | "transport" | null;
export function spatialLabDrift(live?: {
  revision?: string;
  allowedLayers?: string[];
  bannedLayers?: string[];
  amenityCategories?: string[];
  providerIds?: string[];
  transit?: string;
}): { revision: string; differences: object[]; transit: { enabled: false } };
export const DEFAULT_TIMEOUT_MS: number;
export function validate(schema: object, value: unknown): string[];
export function listTools(): Array<{ name: string; permission: "read"; inputSchema: object; outputSchema: object }>;
export function callTool(name: string, input: object, ctx?: {
  listings?: object[];
  isPublicListing?: (listing: object | null) => boolean;
  env?: Record<string, string | undefined>;
  registry?: DataSourceRow[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  log?: (event: { tool: string; ok: boolean; code: string; ms: number }) => void;
  providers?: Array<{ id?: string; observations?: object[] }>;
  now?: number | (() => number);
  lookup?: (hostname: string) => Promise<Array<{ address: string; family?: number }>>;
}): Promise<{ ok: boolean; code?: string; message?: string; data?: object; provenance?: object | null }>;
export function buildSpatialContext(input: {
  listing: object;
  campusId?: string | null;
  providers?: Array<{ id?: string; observations?: object[] }>;
  subjects?: Array<number | string>;
  constraints?: { requiredFacts?: string[] };
  now?: number;
  isPublicListing?: (listing: object | null) => boolean;
}): (CrossReferenceReport & {
  listingId: number;
  straightLineLabel: string | null;
  travelTime: null;
  approxLocation: { lat: number; lng: number; radiusM: number } | null;
  coverageQuality: CoverageGrade;
  warnings: string[];
  analystNote: string;
}) | null;

export const FRESHNESS: readonly SpatialFreshness[];
export const ENVELOPE_KEYS: readonly string[];
export interface EvidenceEnvelope {
  value: unknown;
  source: string | null;
  provider: string | null;
  observedAt: number | null;
  retrievedAt: number | null;
  freshness: SpatialFreshness;
  confidence: number | null;
  classification: SpatialClassification;
  attribution: string | null;
  license: string | null;
  coverage: string | null;
}
export const CONFIDENCE_RULES: Readonly<Record<string, string>>;
export function dataQuality(input?: {
  observations?: object[];
  conflicts?: object[];
  missing?: Array<{ reason?: string }>;
  freshness?: string;
}): {
  freshness: SpatialFreshness;
  confidenceRuleIds: string[];
  completeness: "empty" | "partial" | "complete";
  sourceConflicts: number;
  warnings: string[];
};
export function evidenceEnvelope(input?: {
  value?: unknown;
  source?: string | null;
  provider?: string | null;
  observedAt?: number | string | null;
  retrievedAt?: number | string | null;
  confidence?: number | null;
  classification?: string | null;
  attribution?: string | null;
  license?: string | null;
  coverage?: string | null;
}, options?: { now?: number | null; staleAfterMs?: number }): EvidenceEnvelope;

export const TARGET_TYPES: readonly Array<"location" | "listing" | "neighborhood" | "provider" | "layer" | "event">;
export const CONDITION_OPS: readonly Array<"eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "changed">;
export const MONITORING_FLAG: "SPATIAL_MONITORING";
export function monitoringEnabled(env?: Record<string, string | undefined> | null): boolean;
export function minimumScheduleMs(row: { rateLimits?: { perMinuteDefault?: number; minIntervalMs?: number }; freshnessPolicy?: { minIntervalMs?: number; staleAfterMs?: number } } | null): number | null;
export function assertSchedule(monitor: { providers?: string[]; schedule?: { intervalMs?: number } }, registry?: DataSourceRow[]): {
  ok: boolean;
  code: string;
  provider?: string;
  minimumIntervalMs?: number;
  reason?: string;
};
export function evaluateConditions(baseline: { value?: unknown } | null, value: unknown, conditions?: Array<{ op?: string }>): Array<{
  index: number;
  op: string | null;
  met: boolean;
  reason: string;
}>;
export function beginMonitor(input: object, now: number): { ok: boolean; code?: string; monitor?: object };
export const PRIVACY_GATES: readonly Array<"PUBLIC_EXACT" | "AUTHORIZED_EXACT" | "APPROXIMATE" | "HIDDEN">;
export function runMonitor(monitor: object, now: number, ctx?: {
  env?: Record<string, string | undefined>;
  registry?: DataSourceRow[];
  readings?: object[];
  listing?: object | null;
  authorization?: "PUBLIC_EXACT" | "AUTHORIZED_EXACT" | "APPROXIMATE" | "HIDDEN";
  authorized?: boolean;
  production?: boolean;
}): {
  ok: boolean;
  code: string;
  observations: EvidenceEnvelope[];
  evaluated?: object[];
  provenance?: { monitoringBeganAt?: number; retrievedAt?: number; observedAt?: number | null };
  alerts?: Array<{ notify: false; reason: string; provider: string | null; channel: string | null }>;
};
export function decideNotification(observation?: { provider?: string | null } | null, policy?: { channel?: string | null } | null): {
  notify: false;
  reason: "notification_policy_stub";
  provider: string | null;
  channel: string | null;
};

export const HISTORY_FLAG: "SPATIAL_HISTORY";
export function historyEnabled(env?: Record<string, string | undefined> | null): boolean;
export interface SpatialHistoryResult {
  ok: boolean;
  code: string;
  historyBeganAt: number | null;
  unavailableBefore?: number | null;
  from?: number | null;
  to?: number | null;
  since?: number | null;
  at?: number | null;
  events: object[];
  snapshots: object[];
  undated?: object[];
  changes: object[];
  context: object | null;
  provenance?: {
    source?: string | null;
    historyBeganAt?: number | null;
    observedAt?: number | null;
    retrievedAt?: number | null;
    capturedAt?: number | null;
  } | null;
}
export function getSpatialHistory(input?: {
  monitor?: { monitoringBeganAt?: number | string | Date | null } | null;
  observations?: object[];
  snapshots?: object[];
  from?: number | null;
  to?: number | null;
}, ctx?: { env?: Record<string, string | undefined>; authorized?: boolean; authorization?: string }): SpatialHistoryResult;
export function compareSpatialSnapshots(before?: object | null, after?: object | null, ctx?: { env?: Record<string, string | undefined>; authorized?: boolean; authorization?: string }): {
  ok: boolean;
  code: string;
  added: object[];
  removed: object[];
  changed: object[];
  unchanged: object[];
};
export function getChangesSince(input?: {
  monitor?: { monitoringBeganAt?: number | string | Date | null } | null;
  observations?: object[];
  snapshots?: object[];
  since?: number | null;
  to?: number | null;
}, ctx?: { env?: Record<string, string | undefined>; authorized?: boolean; authorization?: string }): SpatialHistoryResult;
export function replaySpatialContext(input?: {
  monitor?: { monitoringBeganAt?: number | string | Date | null } | null;
  observations?: object[];
  snapshots?: object[];
  at?: number | null;
}, ctx?: { env?: Record<string, string | undefined>; authorized?: boolean; authorization?: string }): SpatialHistoryResult;
export function recordReportSnapshot(monitor: { monitoringBeganAt?: number | string | Date | null } | null, report: object | null, capturedAt: number | string | Date | null, ctx?: { env?: Record<string, string | undefined>; authorized?: boolean; authorization?: string }): {
  ok: boolean;
  code: string;
  historyBeganAt: number | null;
  snapshot?: object;
};

export const ANOMALY_FLAG: "SPATIAL_ANOMALIES";
export const ANOMALY_FAMILIES: readonly string[];
export function anomaliesEnabled(env?: Record<string, string | undefined> | null): boolean;
export interface SpatialAnomaly {
  family: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  reason: string;
  observationIds: string[];
  rule: { name: string; threshold: object; statistic?: object };
  provider: string | null;
  triggeredAt: number;
  evidence: EvidenceEnvelope;
  provenance: {
    source: string | null;
    provider: string | null;
    observedAt: number | null;
    retrievedAt: number | null;
    freshness: string;
    classification: string;
    license: string | null;
    historyBeganAt: number | null;
    rule: string;
  };
  explanation: string | null;
}
export interface SpatialAnomalyResult {
  ok: boolean;
  code: string;
  historyBeganAt?: number | null;
  anomalies: SpatialAnomaly[];
  skipped: Array<{ family: string; code: string; reason: string }>;
  alerts: [];
  explanation: string | null;
  decidedBy: "rule";
  provenance?: {
    source?: string | null;
    historyBeganAt?: number | null;
    observedAt?: number | null;
    retrievedAt?: number | null;
  };
}
export function evaluateAnomalies(input?: {
  monitor?: { monitoringBeganAt?: number | string | Date | null; baseline?: object | null; observationType?: string; target?: object } | null;
  observations?: object[];
  snapshots?: object[];
  now?: number | null;
  families?: string[];
}, ctx?: {
  env?: Record<string, string | undefined>;
  authorized?: boolean;
  authorization?: string;
  explain?: (input: object) => string | { explanation?: string } | null;
}): SpatialAnomalyResult;
export function attachAnomalyExplanation(result: SpatialAnomalyResult, produced?: string | { explanation?: string; severity?: string; anomalies?: object[] } | null): SpatialAnomalyResult;
