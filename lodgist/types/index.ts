// ─── Lodgist TypeScript Types ────────────────────────────────────────────────
// Re-exports from Prisma generated types plus custom domain types.
//
// Run `npx prisma generate` after schema changes to regenerate Prisma types.

// ─── Prisma-generated types (re-exported for convenience) ────────────────────

export type {
  Role,
  User,
  Property,
  Listing,
  Booking,
  Account,
  Session,
  VerificationToken,
  TruthIndexScore,
} from "@prisma/client";

// ─── Custom Domain Types ─────────────────────────────────────────────────────

/** Nigerian Naira price formatting helper type */
export type NgnPrice = number & { readonly __brand: "NgnPrice" };

/** Truth Index score (0-100) */
export type TruthIndexScoreValue = number & { readonly __brand: "TruthIndexScore" };

/** Property listing status (deprecated — use ListingStatus enum from @prisma/client) */
export type ListingStatus = "available" | "rented" | "sold" | "withdrawn";

/** Booking status (deprecated — use BookingStatus enum from @prisma/client) */
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

/** User role names matching Prisma Role enum values */
export type UserRoleName = "USER" | "ARTISAN" | "LANDLORD" | "STUDIO_ADMIN" | "TENANT" | "AGENT";

/** Property types */
export type PropertyType = "apartment" | "house" | "land" | "commercial";

/** Nigerian state names */
export type NigerianState =
  | "Abia" | "Adamawa" | "Akwa Ibom" | "Anambra" | "Bauchi" | "Bayelsa"
  | "Benue" | "Borno" | "Cross River" | "Delta" | "Ebonyi" | "Edo"
  | "Ekiti" | "Enugu" | "FCT" | "Gombe" | "Imo" | "Jigawa" | "Kaduna"
  | "Kano" | "Katsina" | "Kebbi" | "Kogi" | "Kwara" | "Lagos" | "Nasarawa"
  | "Niger" | "Ogun" | "Ondo" | "Osun" | "Oyo" | "Plateau" | "Rivers"
  | "Sokoto" | "Taraba" | "Yobe" | "Zamfara";

// ─── API Response Types ──────────────────────────────────────────────────────

/** Paginated API response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Standard API error response */
export interface ApiErrorResponse {
  message: string;
  errors?: Array<{ path: string; message: string }>;
}

/** Standard API success response with optional data */
export interface ApiSuccessResponse<T = unknown> {
  message?: string;
  data?: T;
}

// ─── Property with relations (for frontend consumption) ──────────────────────

export interface PropertyWithListings {
  id: number;
  address: string;
  city: string;
  state: string;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: number;
    name: string | null;
    email: string;
    role: UserRoleName;
  };
  listings: Array<{
    id: number;
    price: number;
    description: string | null;
    status: string;
    createdAt: Date;
    _count: { bookings: number };
  }>;
}

// ─── Booking with relations ──────────────────────────────────────────────────

export interface BookingWithListing {
  id: string; // Booking.id is cuid
  listingId: number;
  tenantId: number;
  startDate: Date;
  endDate: Date;
  status: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  listing: {
    id: number;
    title: string;
    price: number;
    property: {
      address: string;
      city: string;
      state: string;
    };
  };
  tenant?: {
    id: number;
    name: string | null;
    email: string;
  };
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface AdminDashboardStats {
  totalListings: number;
  flaggedListings: number;
  pendingVerifications: number;
  totalBookings: number;
  totalUsers: number;
  listingsPerState: Array<{ state: string; count: number }>;
  recentBookings: BookingWithListing[];
}
