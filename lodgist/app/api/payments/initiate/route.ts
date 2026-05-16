import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as z from "zod";

// ─── Paystack API helpers ────────────────────────────────────────────────────

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? "";
const PAYSTACK_API = "https://api.paystack.co";

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

async function paystackPost(
  endpoint: string,
  body: Record<string, unknown>
): Promise<PaystackInitResponse> {
  const res = await fetch(`${PAYSTACK_API}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Validation ──────────────────────────────────────────────────────────────

const initiatePaymentSchema = z.object({
  bookingId: z.string({ message: "Booking ID is required." }).min(1),
  email: z.string({ message: "Valid email is required." }).email(),
  amount: z.number({ message: "Amount must be a number." }).positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── POST /api/payments/initiate — Initialize a Paystack transaction ─────────

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

    // Amount in kobo (Paystack uses smallest currency unit)
    const amountInKobo = Math.round(validated.amount * 100);

    const metadata = {
      ...(validated.metadata ?? {}),
      bookingId: validated.bookingId,
      listingId: booking.listingId,
      tenantId: parseInt(session.user.id),
      landlordId: booking.listing.property?.ownerId ?? booking.listing.ownerId,
    };

    const result = await paystackPost("/transaction/initialize", {
      email: validated.email,
      amount: amountInKobo,
      metadata,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/bookings`,
    });

    if (!result.status || !result.data) {
      return NextResponse.json(
        { message: result.message || "Failed to initialize payment." },
        { status: 502 }
      );
    }

    // Create EscrowTransaction so the backend webhook handler has a canonical record to update.
    // paystackReference is the lookup key used by charge.success / transfer.success handlers.
    const landlordId = metadata.landlordId as number;
    await prisma.escrowTransaction.create({
      data: {
        reference: `LODG-PAY-${validated.bookingId}-${Date.now()}`,
        tenantId: parseInt(session.user.id),
        landlordId,
        listingId: booking.listingId,
        amount: validated.amount,
        currency: "NGN",
        status: "PENDING",
        description: `Payment for booking ${validated.bookingId}`,
        paystackReference: result.data.reference,
        paystackAuthorizationUrl: result.data.authorization_url,
      },
    });

    return NextResponse.json({
      authorizationUrl: result.data.authorization_url,
      reference: result.data.reference,
      accessCode: result.data.access_code,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error initiating payment:", error);
    return NextResponse.json(
      { message: "Failed to initiate payment." },
      { status: 500 }
    );
  }
}
