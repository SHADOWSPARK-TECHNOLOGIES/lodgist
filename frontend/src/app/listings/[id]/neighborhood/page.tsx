import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExploreNeighborhood from "@/components/spatial/ExploreNeighborhood";
import { buildPublicSpatialContext } from "@/lib/spatialPublic";
import type { ApproxLocation } from "@/lib/types";
import { loadNeighborhoodListing } from "@/lib/neighborhoodLoad";
import { TIMEOUT_MESSAGE } from "@/lib/requestTimeout";

const neighborhoodCopy = {
  error: "The neighborhood view stays closed until the listing loads. No fixture is substituted.",
  retry: "Try again",
  noLocationTitle: "No neighborhood view for this home yet.",
  noLocation: "This home has no published area to show on a map.",
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Neighborhood",
  description: "Published area, campuses, and nearby places. A map does not prove ownership, condition, availability, or safety.",
};

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
}

export default async function NeighborhoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id)) notFound();

  // A definite 404 is normally rewritten by src/proxy.ts before this runs.
  const result = await loadNeighborhoodListing(id, apiBase());
  if (result.kind === "missing") notFound();

  if (result.kind !== "ok") {
    return (
      <div className="container py-16">
        <h1 className="font-poppins text-xl text-white mb-3">We could not load this home.</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          {result.kind === "timeout" ? TIMEOUT_MESSAGE : neighborhoodCopy.error}
        </p>
        <p className="text-sm mt-4">
          <Link href={`/listings/${id}/neighborhood`} className="underline" style={{ color: "var(--color-teal)" }}>{neighborhoodCopy.retry}</Link>
        </p>
      </div>
    );
  }

  const context = buildPublicSpatialContext(result.listing);
  if (!context) {
    // The home exists but has no public area to show. Say so instead of a 404.
    return (
      <div className="container py-16">
        <h1 className="font-poppins text-xl text-white mb-3">{neighborhoodCopy.noLocationTitle}</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{neighborhoodCopy.noLocation}</p>
        <p className="text-sm mt-4">
          <Link href={`/listings/${id}`} className="underline" style={{ color: "var(--color-teal)" }}>Back to this home</Link>
        </p>
      </div>
    );
  }

  const approx: ApproxLocation | null = context.focus.precision === "approximate"
    ? { lat: context.focus.lat, lng: context.focus.lng, radius_m: context.focus.radiusM }
    : null;

  return (
    <div className="container py-8 max-w-3xl">
      <Link href={`/listings/${context.listingId}`} className="nav-link text-sm">Back to this home</Link>
      <div className="mt-4">
        <ExploreNeighborhood
          listingId={context.listingId}
          title={context.title}
          place={context.focus.label}
          approxLocation={approx}
          startOpen
        />
      </div>
    </div>
  );
}
