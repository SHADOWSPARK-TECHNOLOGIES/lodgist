// ─── Lodgist Typed API Client ──────────────────────────────────────────────
// Generic fetch wrapper with automatic JWT injection, error normalization,
// and typed methods for every backend endpoint.

import type {
  ApiResponse,
  PaginatedResponse,
  AuthResponse,
  PasskeyRegistrationOptionsResponse,
  PasskeyAuthenticationOptionsResponse,
  PasskeyRegistrationVerifyResponse,
  PasskeyListResponse,
  EscrowInitiateResponse,
  User,
  Listing,
  Review,
  EscrowTransaction,
  TruthIndexScore,
  TruthIndexResponse,
  RegisterPayload,
  LoginPayload,
  CreateListingPayload,
  UpdateListingPayload,
  CreateReviewPayload,
  UpdateReviewPayload,
  EscrowInitiatePayload,
} from "./types";
import { getToken } from "./auth";

// ─── Configuration ─────────────────────────────────────────────────────────

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

// ─── Error Types ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Internal Helpers ──────────────────────────────────────────────────────

function apiUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${clean}`;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(path), {
    method,
    ...options,
    headers,
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      (body as Record<string, string>)?.error ||
      (body as Record<string, string>)?.message ||
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  return body as T;
}

// ─── Auth API ──────────────────────────────────────────────────────────────

export const authApi = {
  /** Register a new user with email + password */
  register: (payload: RegisterPayload) =>
    request<AuthResponse>("POST", "/api/auth/register", {
      body: JSON.stringify(payload),
    }),

  /** Login with email + password */
  login: (payload: LoginPayload) =>
    request<ApiResponse<AuthResponse>>("POST", "/api/auth/login", {
      body: JSON.stringify(payload),
    }),

  // ── Passkey (WebAuthn) ──

  /** Step 1: Get registration options (challenge) from the server */
  passkeyRegisterOptions: (userId: number) =>
    request<PasskeyRegistrationOptionsResponse>(
      "POST",
      "/api/auth/passkey/register/options",
      { body: JSON.stringify({ userId }) }
    ),

  /** Step 2: Send verified credential back to the server */
  passkeyRegisterVerify: (userId: number, credential: unknown) =>
    request<PasskeyRegistrationVerifyResponse>(
      "POST",
      "/api/auth/passkey/register/verify",
      { body: JSON.stringify({ userId, credential }) }
    ),

  /** Step 1: Get authentication options (challenge) */
  passkeyLoginOptions: (email?: string) =>
    request<PasskeyAuthenticationOptionsResponse>(
      "POST",
      "/api/auth/passkey/login/options",
      { body: JSON.stringify({ email }) }
    ),

  /** Step 2: Verify passkey assertion and get JWT */
  passkeyLoginVerify: (credential: unknown) =>
    request<AuthResponse>("POST", "/api/auth/passkey/login/verify", {
      body: JSON.stringify({ credential }),
    }),

  /** List all registered passkeys for the authenticated user */
  listPasskeys: () => request<PasskeyListResponse>("GET", "/api/auth/passkeys"),

  /** Delete a passkey by credential ID */
  deletePasskey: (credentialId: string) =>
    request<ApiResponse>("DELETE", `/api/auth/passkeys/${credentialId}`),
};

// ─── Users API ─────────────────────────────────────────────────────────────

export const usersApi = {
  /** List all users (STUDIO_ADMIN only) */
  list: () => request<ApiResponse<User[]>>("GET", "/api/users"),

  /** Get a single user by ID */
  get: (id: number) => request<ApiResponse<User>>("GET", `/api/users/${id}`),

  /** Update a user (STUDIO_ADMIN only) */
  update: (id: number, data: Partial<User>) =>
    request<ApiResponse<User>>("PUT", `/api/users/${id}`, {
      body: JSON.stringify(data),
    }),

  /** Delete a user (STUDIO_ADMIN only) */
  delete: (id: number) => request<ApiResponse>("DELETE", `/api/users/${id}`),
};

// ─── Listings API ──────────────────────────────────────────────────────────

export const listingsApi = {
  /** List all listings with optional filters and pagination */
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    state?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.state) searchParams.set("state", params.state);
    if (params?.minPrice) searchParams.set("minPrice", String(params.minPrice));
    if (params?.maxPrice) searchParams.set("maxPrice", String(params.maxPrice));
    if (params?.search) searchParams.set("search", params.search);
    const qs = searchParams.toString();
    return request<PaginatedResponse<Listing>>(
      "GET",
      `/api/listings${qs ? `?${qs}` : ""}`
    );
  },

  /** Get a single listing with full relations */
  get: (id: number) =>
    request<ApiResponse<Listing>>("GET", `/api/listings/${id}`),

  /** Create a new listing */
  create: (payload: CreateListingPayload) =>
    request<ApiResponse<Listing>>("POST", "/api/listings", {
      body: JSON.stringify(payload),
    }),

  /** Update a listing */
  update: (id: number, payload: UpdateListingPayload) =>
    request<ApiResponse<Listing>>("PUT", `/api/listings/${id}`, {
      body: JSON.stringify(payload),
    }),

  /** Delete a listing */
  delete: (id: number) =>
    request<ApiResponse>("DELETE", `/api/listings/${id}`),

  /** Analyze a listing for scam signals */
  analyzeScam: (listingId: number) =>
    request<ApiResponse>("POST", "/api/listings/analyze-scam", {
      body: JSON.stringify({ listingId }),
    }),
};

// ─── Reviews API ───────────────────────────────────────────────────────────

export const reviewsApi = {
  /** Get reviews for a listing with pagination and stats */
  list: (listingId: number, params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return request<ApiResponse<{ data: Review[]; pagination: { page: number; limit: number; total: number; pages: number }; stats: { averageRating: number; totalReviews: number } }>>(
      "GET",
      `/api/reviews/${listingId}${qs ? `?${qs}` : ""}`
    );
  },

  /** Create a review */
  create: (payload: CreateReviewPayload) =>
    request<ApiResponse<Review>>("POST", "/api/reviews", {
      body: JSON.stringify(payload),
    }),

  /** Update a review */
  update: (id: number, payload: UpdateReviewPayload) =>
    request<ApiResponse<Review>>("PUT", `/api/reviews/${id}`, {
      body: JSON.stringify(payload),
    }),

  /** Delete a review */
  delete: (id: number) =>
    request<ApiResponse>("DELETE", `/api/reviews/${id}`),
};

// ─── TruthIndex API ────────────────────────────────────────────────────────

export const truthIndexApi = {
  /** Get current TruthIndex for a user */
  get: (userId: number) =>
    request<ApiResponse<TruthIndexResponse>>("GET", `/api/truth-index/${userId}`),

  /** Recalculate TruthIndex for the current user */
  recalculate: () =>
    request<ApiResponse<TruthIndexResponse>>("POST", "/api/truth-index/recalculate"),

  /** Get TruthIndex history (last 30 records) */
  history: (userId: number) =>
    request<ApiResponse<TruthIndexScore[]>>("GET", `/api/truth-index/${userId}/history`),
};

// ─── Escrow API ────────────────────────────────────────────────────────────

export const escrowApi = {
  /** Initiate an escrow transaction (triggers Paystack checkout) */
  initiate: (payload: EscrowInitiatePayload) =>
    request<EscrowInitiateResponse>("POST", "/api/escrow/initiate", {
      body: JSON.stringify(payload),
    }),

  /** Confirm payment (called after Paystack redirect) */
  confirm: (id: number) =>
    request<ApiResponse<EscrowTransaction>>("POST", `/api/escrow/${id}/confirm`),

  /** Release funds to landlord */
  release: (id: number) =>
    request<ApiResponse<EscrowTransaction>>("POST", `/api/escrow/${id}/release`),

  /** List current user's escrow transactions */
  list: () => request<ApiResponse<EscrowTransaction[]>>("GET", "/api/escrow"),

  /** Get a single escrow transaction */
  get: (id: number) =>
    request<ApiResponse<EscrowTransaction>>("GET", `/api/escrow/${id}`),
};

// ─── Legacy apiFetch (raw Response wrapper for compatibility) ──────────────

/**
 * Raw fetch wrapper that returns the Response object (not pre-parsed JSON).
 * Used by older components. Throws ApiError on non-2xx status.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { body = null; }
    const message =
      (body as Record<string, string>)?.error ||
      (body as Record<string, string>)?.message ||
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  return res;
}

// ─── Utility: Raw fetch (for custom endpoints) ─────────────────────────────

export { request as apiRequest, apiUrl };
