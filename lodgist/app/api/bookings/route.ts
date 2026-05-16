import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

// ─── Validation ──────────────────────────────────────────────────────────────

const createBookingSchema = z.object({
  listingId: z.number({ message: "Listing ID is required." }).int().positive(),
  startDate: z.string({ message: "Start date is required." }).min(1),
  endDate: z.string({ message: "End date is required." }).min(1),
});

// ─── GET /api/bookings — List bookings for the authenticated user ────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role"); // optional filter

    let bookings;

    if (role === "LANDLORD" || role === "AGENT") {
      // Landlord/Agent sees bookings for their listings
      bookings = await prisma.booking.findMany({
        where: {
          listing: {
            ownerId: parseInt(session.user.id),
          },
        },
        include: {
          listing: {
            select: {
              id: true,
              price: true,
              property: {
                select: { address: true, city: true, state: true },
              },
            },
          },
          tenant: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // TENANT sees their own bookings
      bookings = await prisma.booking.findMany({
        where: { tenantId: parseInt(session.user.id) },
        include: {
          listing: {
            select: {
              id: true,
              price: true,
              property: {
                select: { address: true, city: true, state: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { message: "Failed to fetch bookings." },
      { status: 500 }
    );
  }
}

// ─── POST /api/bookings — Create a new booking (TENANT flow) ────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = createBookingSchema.parse(body);

    // Verify the listing exists and is available
    const listing = await prisma.listing.findUnique({
      where: { id: validated.listingId },
      include: {
        property: {
          select: { ownerId: true },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ message: "Listing not found." }, { status: 404 });
    }

    if (listing.status !== "VERIFIED") {
      return NextResponse.json(
        { message: "This listing is no longer available for booking." },
        { status: 409 }
      );
    }

    // Prevent a landlord from booking their own listing
    if (listing.property?.ownerId === parseInt(session.user.id)) {
      return NextResponse.json(
        { message: "You cannot book your own listing." },
        { status: 403 }
      );
    }

    // Check for overlapping bookings
    const startDate = new Date(validated.startDate);
    const endDate = new Date(validated.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { message: "Invalid date format. Use ISO 8601 (e.g. 2025-06-01)." },
        { status: 400 }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { message: "End date must be after start date." },
        { status: 400 }
      );
    }

    const overlapping = await prisma.booking.findFirst({
      where: {
        listingId: validated.listingId,
        status: { not: "CANCELLED" },
        AND: [
          { startDate: { lt: endDate } },
          { endDate: { gt: startDate } },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { message: "This listing is already booked for the selected dates." },
        { status: 409 }
      );
    }

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        listingId: validated.listingId,
        tenantId: parseInt(session.user.id),
        startDate,
        endDate,
        totalAmount: listing.price,
        status: "PENDING",
      },
      include: {
        listing: {
          select: {
            id: true,
            price: true,
            property: {
              select: { address: true, city: true, state: true },
            },
          },
        },
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { message: "Failed to create booking." },
      { status: 500 }
    );
  }
}
