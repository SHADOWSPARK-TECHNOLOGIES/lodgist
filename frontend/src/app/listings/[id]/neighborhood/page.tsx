import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExploreNeighborhood from "@/components/spatial/ExploreNeighborhood";
import { anonymousListingRequest, buildPublicSpatialContext } from "@/lib/spatialLab";
import type { ApproxLocation } from "@/lib/types";

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

  let listing: object | null = null;
  let upstream = false;
  try {
    const upstreamRequest = anonymousListingRequest(apiBase(), id);
    const response = await fetch(upstreamRequest.url, upstreamRequest.init);
    if (response.status === 404) {
      listing = null;
    } else if (!response.ok) {
      upstream = true;
    } else {
      const body = (await response.json()) as { data?: object };
      listing = body.data ?? null;
    }
  } catch {
    upstream = true;
  }

  if (upstream) {
    return (
      <div className="container py-16">
        <h1 className="font-poppins text-xl text-white mb-3">We could not load this home.</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>The neighborhood view stays closed until the listing loads. No fixture is substituted.</p>
      </div>
    );
  }

  if (!listing) notFound();
  const context = buildPublicSpatialContext(listing);
  if (!context) notFound();

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
