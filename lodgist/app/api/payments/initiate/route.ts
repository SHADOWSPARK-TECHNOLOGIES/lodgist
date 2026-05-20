import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

// ─── Validation ──────────────────────────────────────────────────────────────

const initiatePaymentSchema = z.object({
  bookingId: z.string({ message: "Booking ID is required." }).min(1),
  email: z.string({ message: "Valid email is required." }).email(),
  amount: z.number({ message: "Amount must be a number." }).positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const SUPPORT_WHATSAPP =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace("+", "") ?? "2348000000000";

// ─── POST /api/payments/initiate — Route tenant to support for payment ───────
// Automated Paystack flow is temporarily replaced by a WhatsApp support handoff.
// The booking record is validated and an escrow intent is recorded, then the
// tenant is directed to WhatsApp to complete payment with the support team.

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = initiatePaymentSchema.parse(body);

    // Verify the booking exists and belongs to the authenticated user
    const booking = await prisma.booking.findUnique({
      where: { id: validated.bookingId },
      include: {
        listing: {
          select: {
            id: true,
            price: true,
            title: true,
            ownerId: true,
            property: {
              select: { ownerId: true },
            },
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ message: "Booking not found." }, { status: 404 });
    }

    if (booking.tenantId !== parseInt(session.user.id)) {
      return NextResponse.json(
        { message: "You can only pay for your own bookings." },
        { status: 403 }
      );
    }

    if (booking.status !== "PENDING") {
      return NextResponse.json(
        { message: `Booking is already ${booking.status}. Cannot initiate payment.` },
        { status: 409 }
      );
    }

    const propertyTitle = booking.listing.title ?? "your property";

    // Build a pre-filled WhatsApp message so the support agent has context immediately
    const waText = encodeURIComponent(
      `Hi Lodgist Support, I'd like to complete payment for my booking.\n\n` +
        `Booking ID: ${validated.bookingId}\n` +
        `Property: ${propertyTitle}\n` +
        `Amount: NGN ${validated.amount.toLocaleString()}\n` +
        `Email: ${validated.email}\n\n` +
        `Please assist me with next steps.`
    );

    const supportUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${waText}`;

    return NextResponse.json({
      mode: "support",
      message:
        "Automated payment is temporarily unavailable. A support agent will guide you through payment securely via WhatsApp.",
      supportUrl,
      bookingId: validated.bookingId,
      amount: validated.amount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error in payment initiate:", error);
    return NextResponse.json(
      { message: "Failed to process payment request." },
      { status: 500 }
    );
  }
}
