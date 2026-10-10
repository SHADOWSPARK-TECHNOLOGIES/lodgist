import { NextResponse } from "next/server";
import { buildPublicSpatialContext, campusById } from "@/lib/spatialPublic";
import { loadListingSpatial } from "@/lib/spatialTool";

export const dynamic = "force-dynamic";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id)) {
    return NextResponse.json({ success: false, error: "unavailable" }, { status: 404 });
  }

  let listing: object | null = null;
  try {
    const response = await fetch(`${apiBase()}/api/listings/${id}`, { cache: "no-store" });
    if (response.status === 404) {
      return NextResponse.json({ success: false, error: "unavailable" }, { status: 404 });
    }
    if (!response.ok) {
      return NextResponse.json({ success: false, error: "upstream" }, { status: 503 });
    }
    const body = (await response.json()) as { data?: object };
    listing = body.data ?? null;
  } catch {
    return NextResponse.json({ success: false, error: "upstream" }, { status: 503 });
  }

  if (!listing) {
    return NextResponse.json({ success: false, error: "unavailable" }, { status: 404 });
  }

  const context = buildPublicSpatialContext(listing);
  if (!context) {
    return NextResponse.json({ success: false, error: "unavailable" }, { status: 404 });
  }

  const campus = campusById(new URL(request.url).searchParams.get("campus"));
  const { amenities, route } = await loadListingSpatial({
    listingId: Number(id),
    campusId: campus ? campus.id : null,
    precision: context.focus.precision,
    fetchImpl: fetch,
  });

  return NextResponse.json(
    { success: true, data: { ...context, amenities, route } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
