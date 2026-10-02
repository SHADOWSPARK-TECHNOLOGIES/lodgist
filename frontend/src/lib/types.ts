// ─── Lodgist Frontend Type System ──────────────────────────────────────────
// Mirrors backend API response shapes for full-stack type safety.

// ─── Prisma-mirrored Types ─────────────────────────────────────────────────

export type Role = "USER" | "ARTISAN" | "LANDLORD" | "STUDIO_ADMIN";

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  isHNW: boolean;
  hnwVerifiedAt: string | null;
  truthIndex: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PasskeyCredential {
  id: number;
  credentialId: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string;
}

export interface PropertyRecord {
  id: number;
  title: string;
  description: string | null;
  /** Never sent by the public listing API; exact location stays server-side. */
  address?: string;
  city: string;
  state: string;
  lga?: string | null;
  price: number;
  currency: string;
  type: string;
  status: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApproxLocation {
  lat: number;
  lng: number;
  radius_m: number;
}

export interface ListingImage {
  id: number;
  url: string;
  caption: string | null;
  isPrimary: boolean;
  listingId: number;
}

export interface Listing {
  id: number;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  status: string;
  isFlaggedForFraud?: boolean;
  riskState?: string | null;
  truthIndex?: number | null;
  totalMoveInCost?: { total?: number; sample?: boolean } | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  ownerId: number;
  propertyId: number;
  createdAt: string;
  updatedAt: string;
  images: ListingImage[];
  property: PropertyRecord | null;
  /** About 500 m around the property (0.005° grid). Null when no coordinates. */
  approxLocation?: ApproxLocation | null;
  owner: Pick<User, "id" | "name" | "email" | "role" | "truthIndex"> | null;
  fraudSignals: FraudSignal[];
  reviews?: ReviewStats;
}

export interface ViewingRequestResult {
  id: number;
  status: string;
  listingId: number;
  preferredDate: string;
  preferredTime: string | null;
}

export interface Review {
  id: number;
  listingId: number;
  userId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, "id" | "name">;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
}

export interface FraudSignal {
  id: number;
  listingId: number;
  signalType: string;
  severity: string;
  description: string | null;
  detectedAt: string;
}

export interface EscrowTransaction {
  id: number;
  tenantId: number;
  landlordId: number;
  listingId: number;
  amount: number;
  currency: string;
  status: string;
  reference: string | null;
  paystackAccessCode: string | null;
  landlordRecipientCode: string | null;
  landlordTransferCode: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: Pick<User, "id" | "name" | "email">;
  landlord?: Pick<User, "id" | "name" | "email">;
}

export interface TruthIndexScore {
  id: number;
  userId: number;
  score: number;
  components: Record<string, unknown> | null;
  calculatedAt: string;
}

export interface TruthIndexResponse {
  truthIndex: number | null;
  components?: Record<string, unknown>;
  latestRecord?: TruthIndexScore | null;
}

// ─── API Response Wrappers ─────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  stats?: ReviewStats;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: Pick<User, "id" | "email" | "name" | "role" | "isHNW">;
}

export interface PasskeyRegistrationOptionsResponse {
  success: boolean;
  options: PublicKeyCredentialCreationOptions;
  challenge: string;
}

export interface PasskeyAuthenticationOptionsResponse {
  success: boolean;
  options: PublicKeyCredentialRequestOptions;
  challenge: string;
}

export interface PasskeyRegistrationVerifyResponse {
  success: boolean;
  message: string;
  credentialId: string;
}

export interface PasskeyListResponse {
  success: boolean;
  data: PasskeyCredential[];
}

export interface EscrowInitiateResponse {
  success: boolean;
  data: {
    authorization_url: string;
    reference: string;
  };
}

// ─── Request Payloads ──────────────────────────────────────────────────────

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface CreateListingPayload {
  title: string;
  description?: string;
  price: number;
  currency?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  propertyId: number;
}

export interface UpdateListingPayload {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  status?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
}

export interface CreateLeadPayload {
  location: string;
  budget: number;
  bedrooms: number;
  moveInTimeframe: string;
  phone: string;
  email?: string;
}

export interface LeadSaved {
  id: number;
}

export interface TenantBooking {
  id: string;
  listingId: number;
  totalAmount: number;
  currency: string;
  status: string;
  listing?: { id: number; title: string; price: number } | null;
}

export interface CreateReviewPayload {
  listingId: number;
  rating: number;
  comment?: string;
}

export interface UpdateReviewPayload {
  rating?: number;
  comment?: string;
}

export interface EscrowInitiatePayload {
  listingId: number;
  landlordId: number;
  amount: number;
  currency?: string;
}

// ─── Dashboard Types ───────────────────────────────────────────────────────

export type DashboardTab = "overview" | "listings" | "reviews" | "passkeys" | "hnw";

export interface DashboardStats {
  totalListings: number;
  activeListings: number;
  totalReviews: number;
  averageRating: number | null;
  truthIndex: number | null;
  isHNW: boolean;
  passkeyCount: number;
}

// ─── Liveness Gate Types ───────────────────────────────────────────────────

export interface HNWVerificationStatus {
  isHNW: boolean;
  hnwVerifiedAt: string | null;
  threshold: number;
  currency: string;
}
