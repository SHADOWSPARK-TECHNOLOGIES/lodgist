import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initializeTrustComponents } from "@/lib/trust/computeTruthIndex";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const listingId = parseInt(id, 10);

  if (isNaN(listingId)) {
    return NextResponse.json({ message: "Invalid listing ID." }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, riskState: true, truthIndex: true },
  });

  if (!listing) {
    return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  }

  await initializeTrustComponents(listingId, prisma);

  const [components, latestRequest] = await Promise.all([
    prisma.trustComponent.findMany({
      where: { listingId },
      select: { label: true, passed: true, weight: true, notes: true },
      orderBy: { weight: "desc" },
    }),
    prisma.verificationRequest.findFirst({
      where: { listingId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
  ]);

  return NextResponse.json({
    riskState: listing.riskState,
    truthIndex: listing.truthIndex ?? 0,
    verificationStatus: latestRequest?.status ?? null,
    components,
  });
}
