import * as z from "zod";

/**
 * Lodgist field-intake schema for hostel operator visits.
 *
 * This is the structured form of docs/outreach/hostel-operator-outreach.md §4.
 * It exists because the generic `propertyCreateSchema` cannot express what the
 * Lodgist brief requires: separate price components, per-claim provenance, and
 * the six independent listing dimensions (origin, publication, availability,
 * verification, location precision, action eligibility).
 *
 * Design rules (from the brief):
 *  - Never infer a value the operator did not state. Unknown is a real answer.
 *  - Every claim carries the date it was made.
 *  - Price components stay separate so a total can be shown as incomplete.
 *  - Verification is a review outcome, never a form field the operator sets.
 */

// ─── Corridor areas ────────────────────────────────────────────────

export const PILOT_AREAS = [
  "Eziobodo",
  "Ihiagwa",
  "Nekede",
  "Obinze",
  "Naze",
  "Umuguma",
  "Owerri Municipal",
  "Other",
] as const;

export const NEAREST_CAMPUS = [
  "FUTO",
  "Federal Poly Nekede",
  "Alvan Ikoku",
  "IMSU",
  "Other",
] as const;

// ─── Listing dimensions (brief §5) ─────────────────────────────────

export const LISTING_ORIGIN = [
  "direct_submission",
  "authorized_import",
  "external_reference",
] as const;

export const PUBLICATION_STATUS = [
  "draft",
  "review",
  "published",
  "suspended",
  "removed",
] as const;

export const AVAILABILITY_STATUS = [
  "unknown",
  "reported_available",
  "recently_confirmed",
  "unavailable",
  "expired",
] as const;

export const VERIFICATION_STATUS = [
  "not_checked",
  "pending",
  "partially_checked",
  "checks_completed",
  "expired",
  "revoked",
] as const;

export const LOCATION_PRECISION = ["exact", "approximate", "unknown"] as const;

export const ACTION_ELIGIBILITY = [
  "source_link_only",
  "enquiry",
  "viewing_request",
] as const;

// ─── Operator relationship ─────────────────────────────────────────

export const OPERATOR_RELATIONSHIP = [
  "owner",
  "authorized_agent",
  "manager",
  "tenant_sublet",
] as const;

export const AUTHORITY_EVIDENCE = [
  "ownership_document",
  "owner_written_consent",
  "agency_agreement",
  "tenancy_agreement",
  "none_seen",
] as const;

// ─── Room & facilities ─────────────────────────────────────────────

export const ROOM_TYPES = [
  "single_room",
  "self_contain",
  "shared_room",
  "one_bedroom",
  "two_bedroom",
  "other",
] as const;

export const OCCUPANCY_POLICY = [
  "mixed",
  "female_only",
  "male_only",
  "unknown",
] as const;

export const POWER_SOURCE = ["grid", "generator", "solar", "mixed", "unknown"] as const;
export const WATER_SOURCE = ["borehole", "tank", "municipal", "unknown"] as const;
export const CLAIM_STATUS = ["claimed", "verified", "unknown"] as const;

// ─── Helpers ───────────────────────────────────────────────────────

/** A money amount that is either a stated figure or explicitly unknown. */
const moneyComponent = z.object({
  amount: z.coerce.number().nonnegative().nullable().default(null),
  unknown: z.boolean().default(false),
  note: z.string().max(200).optional(),
});

const claimWithDate = z.object({
  status: z.enum(CLAIM_STATUS).default("unknown"),
  /** ISO date the operator made this claim. */
  claimedOn: z.string().optional(),
});

// ─── Main schema ───────────────────────────────────────────────────

export const hostelIntakeSchema = z.object({
  // ── Operator ──
  operator: z.object({
    name: z.string().min(2, "Operator name is required."),
    phone: z.string().min(7, "A reachable phone number is required."),
    whatsapp: z.string().optional(),
    relationship: z.enum(OPERATOR_RELATIONSHIP),
    /** Only meaningful when relationship is authorized_agent. */
    disclosedAgentFee: moneyComponent.optional(),
    authorityEvidence: z.enum(AUTHORITY_EVIDENCE),
    authorityNote: z.string().max(500).optional(),
  }),

  // ── Property identity ──
  property: z.object({
    lodgeName: z.string().min(2, "Lodge name is required."),
    area: z.enum(PILOT_AREAS),
    areaOther: z.string().max(120).optional(),
    landmark: z.string().max(200).optional(),
    nearestCampus: z.enum(NEAREST_CAMPUS),
    /** Straight-line walking minutes to the campus gate, as stated. */
    walkingMinutesToGate: z.coerce.number().int().nonnegative().nullable().default(null),
    transportMode: z.string().max(80).optional(),
    transportCost: moneyComponent.optional(),
  }),

  // ── Location precision (brief §8 — never invent a precise pin) ──
  location: z.object({
    precision: z.enum(LOCATION_PRECISION).default("unknown"),
    latitude: z.coerce.number().min(-90).max(90).nullable().default(null),
    longitude: z.coerce.number().min(-180).max(180).nullable().default(null),
    /** Where the coordinates came from. */
    coordinateSource: z.string().max(200).optional(),
  }),

  // ── Rooms ──
  rooms: z.object({
    roomTypes: z.array(z.enum(ROOM_TYPES)).min(1, "Select at least one room type."),
    bedsPerRoom: z.coerce.number().int().positive().nullable().default(null),
    sharedBathroom: z.boolean().nullable().default(null),
    sharedKitchen: z.boolean().nullable().default(null),
    occupancyPolicy: z.enum(OCCUPANCY_POLICY).default("unknown"),
  }),

  // ── Cost components (brief §7 — never merge into one number) ──
  costs: z.object({
    rent: moneyComponent,
    /** Rent period must be explicit — monthly and annual are not comparable. */
    rentPeriod: z.enum(["per_year", "per_session", "per_month", "unknown"]).default("unknown"),
    deposit: moneyComponent,
    agencyFee: moneyComponent,
    legalFee: moneyComponent,
    serviceCharge: moneyComponent,
    utilities: moneyComponent,
    otherCharge: moneyComponent,
  }),

  // ── Facilities as claimed, each with a date ──
  facilities: z.object({
    power: claimWithDate.extend({ source: z.enum(POWER_SOURCE).default("unknown") }),
    powerHoursPerDay: z.coerce.number().int().min(0).max(24).nullable().default(null),
    water: claimWithDate.extend({ source: z.enum(WATER_SOURCE).default("unknown") }),
    security: claimWithDate.extend({ hours: z.string().max(80).optional() }),
    wifi: claimWithDate.extend({ provider: z.string().max(80).optional() }),
    furnished: claimWithDate.extend({ includes: z.string().max(300).optional() }),
  }),

  // ── Media ──
  media: z.object({
    /** Count of photos captured on the visit. */
    photoCount: z.coerce.number().int().nonnegative().default(0),
    /** Written permission to publish the photos. */
    publishPermission: z.boolean().default(false),
    capturedOn: z.string().optional(),
  }),

  // ── Listing state (brief §5) ──
  listing: z.object({
    origin: z.enum(LISTING_ORIGIN).default("direct_submission"),
    publication: z.enum(PUBLICATION_STATUS).default("draft"),
    availability: z.enum(AVAILABILITY_STATUS).default("unknown"),
    /**
     * Always starts not_checked. The operator cannot set this — only a
     * reviewer decision moves it. Kept in the schema so the default is
     * explicit rather than assumed.
     */
    verification: z.enum(VERIFICATION_STATUS).default("not_checked"),
    actionEligibility: z.enum(ACTION_ELIGIBILITY).default("enquiry"),
  }),

  // ── Reviewer ──
  reviewer: z.object({
    visitedBy: z.string().min(2, "Record who made the visit."),
    visitedOn: z.string().min(4, "Record the visit date."),
    notes: z.string().max(2000).optional(),
  }),
});

export type HostelIntakeInput = z.infer<typeof hostelIntakeSchema>;

// ─── Derived helpers ───────────────────────────────────────────────

/**
 * Total known move-in cost. Returns null components separately so the UI can
 * show that a total excluding unknowns is incomplete (brief §7).
 */
export function totalKnownMoveInCost(costs: HostelIntakeInput["costs"]) {
  const parts = [
    costs.rent,
    costs.deposit,
    costs.agencyFee,
    costs.legalFee,
    costs.serviceCharge,
    costs.utilities,
    costs.otherCharge,
  ];

  const known = parts.reduce((sum, p) => sum + (p?.unknown ? 0 : (p?.amount ?? 0)), 0);
  const unknownCount = parts.filter((p) => p?.unknown || p?.amount === null).length;

  return {
    knownTotal: known,
    unknownCount,
    isComplete: unknownCount === 0,
  };
}

/** Format naira for display. */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

/**
 * Public-facing label for a verification state. Every label must map to a
 * stored decision (brief §5) — this function is the single place that mapping
 * lives so it cannot drift.
 */
export function verificationLabel(status: HostelIntakeInput["listing"]["verification"]): string {
  switch (status) {
    case "not_checked":
      return "Not verified by Lodgist";
    case "pending":
      return "Verification in progress";
    case "partially_checked":
      return "Partially checked";
    case "checks_completed":
      return "Checks completed";
    case "expired":
      return "Checks expired";
    case "revoked":
      return "Verification revoked";
  }
}
