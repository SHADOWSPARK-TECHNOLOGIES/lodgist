import type { AmenityPayload, RoutePayload } from "@lodgist/spatial-core";

export function amenitiesFromTool(payload: unknown): AmenityPayload;
export function routeFromTool(payload: unknown, precision?: string): RoutePayload;
export function loadListingSpatial(options: {
  listingId: number;
  campusId?: string | null;
  precision?: string;
  fetchImpl: typeof fetch;
  env?: Record<string, string | undefined>;
}): Promise<{ amenities: AmenityPayload; route: RoutePayload }>;
