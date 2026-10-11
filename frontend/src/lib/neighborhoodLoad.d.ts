export declare function loadNeighborhoodListing(
  id: string,
  apiBase: string,
  fetchImpl?: (url: string, init: RequestInit) => Promise<{ status: number; ok: boolean; json: () => Promise<unknown> }>,
  ms?: number,
): Promise<{ kind: "ok"; listing: object } | { kind: "missing" | "timeout" | "error" }>;
