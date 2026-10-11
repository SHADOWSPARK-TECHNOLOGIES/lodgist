export declare const MISSING_LISTING_PATH: string;
export declare const LOOKUP_TIMEOUT_MS: number;
export declare function lookupStatus(
  id: string,
  apiBase: string,
  fetchImpl?: (url: string, init: RequestInit) => Promise<{ status: number }>,
): Promise<number>;
export declare function listingRouteDecision(
  id: string,
  getStatus: (id: string) => Promise<number>,
): Promise<{ rewrite: string; status: number } | null>;
