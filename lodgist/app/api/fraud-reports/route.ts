import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ─── POST /api/fraud-reports — Report a listing as fraudulent ────────────────

export async function POST(req: NextRequest) {
  const session = await auth();

  try {
    const formData = await req.formData();
    const listingId = formData.get("listingId") as string | null;

    if (!listingId) {
      return NextResponse.json(
        { message: "Listing ID is required." },
        { status: 400 },
      );
    }

    // Verify the listing exists
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, isFlaggedForFraud: true },
    });

    if (!listing) {
      return NextResponse.json(
        { message: "Listing not found." },
        { status: 404 },
      );
    }

    // Flag the listing for fraud review
    await prisma.listing.update({
      where: { id: listingId },
      data: {
        isFlaggedForFraud: true,
        fraudReason: session?.user?.id
          ? "Reported by user"
          : "Reported by anonymous user",
      },
    });

    return NextResponse.json(
      {
        message:
          "Thank you for your report. Our team will review this listing and take appropriate action.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error reporting fraud:", error);
    return NextResponse.json(
      { message: "Failed to submit fraud report. Please try again." },
      { status: 500 },
    );
  }
}
