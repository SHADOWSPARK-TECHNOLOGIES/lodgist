import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidListingId } from "@/lib/requestTimeout";
import ListingDetailClient from "./ListingDetailClient";

// Resolved per request so a missing listing returns a real 404 status.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
};

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
}

/**
 * Anonymous lookup. Only a definite 404 counts as missing; an API outage or
 * timeout still renders the page so its own retry state can show. Non-public
 * listings are 404 here too, and not-found.tsx lets a signed-in owner or admin
 * load them in the browser.
 */
async function publicLookup(id: string): Promise<"found" | "missing" | "unknown"> {
  try {
    const res = await fetch(`${apiBase()}/api/listings/${id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return "missing";
    return res.ok ? "found" : "unknown";
  } catch {
    return "unknown";
  }
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidListingId(id)) notFound();
  if ((await publicLookup(id)) === "missing") notFound();
  return <ListingDetailClient />;
}
