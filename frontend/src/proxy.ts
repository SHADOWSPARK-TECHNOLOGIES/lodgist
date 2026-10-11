import { NextResponse, type NextRequest } from "next/server";
import { MISSING_LISTING_PATH, listingRouteDecision, lookupStatus } from "@/lib/listingNotFoundRoute";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
}

/**
 * A page that calls notFound() gets an empty server HTML shell from Next.js
 * (vercel/next.js#99793): no layout, no <main>, no skip-link target until JS
 * runs. Missing listings are rewritten here instead, keeping the 404 status and
 * a fully server-rendered not-found page.
 */
export async function proxy(req: NextRequest) {
  const [, first, id = ""] = req.nextUrl.pathname.split("/");
  if (`/${first}` === MISSING_LISTING_PATH) {
    // The missing page is only meaningful as a 404, even when hit directly.
    return NextResponse.rewrite(req.nextUrl, { status: 404 });
  }
  const decision = await listingRouteDecision(id, (value) => lookupStatus(value, apiBase()));
  if (!decision) return NextResponse.next();
  return NextResponse.rewrite(new URL(decision.rewrite, req.url), { status: decision.status });
}

export const config = { matcher: ["/listings/:id", "/listings/:id/neighborhood", "/listing-not-found/:id"] };
