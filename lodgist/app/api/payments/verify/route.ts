import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as z from "zod";

// ─── Paystack API helpers ────────────────────────────────────────────────────

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? "";
const PAYSTACK_API = "https://api.paystack.co";

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at: string;
    channel: string;
    customer: {
      email: string;
      phone?: string;
    };
    metadata?: Record<string, unknown>;
  };
}

async function paystackGet(endpoint: string): Promise<PaystackVerifyResponse> {
  const res = await fetch(`${PAYSTACK_API}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return res.json();
}

// ─── Validation ──────────────────────────────────────────────────────────────

const verifyPaymentSchema = z.object({
  reference: z.string({ message: "Transaction reference is required." }).min(1),
});

// ─── POST /api/payments/verify — Verify a Paystack transaction ──────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = verifyPaymentSchema.parse(body);

    const result = await paystackGet(`/transaction/verify/${validated.reference}`);

    if (!result.status || !result.data) {
      return NextResponse.json(
        { message: result.message || "Payment verification failed." },
        { status: 502 }
      );
    }

    const paymentData = result.data;
    const isSuccessful = paymentData.status === "success";

    return NextResponse.json({
      verified: isSuccessful,
      reference: paymentData.reference,
      amount: paymentData.amount / 100, // Convert from kobo to NGN
      currency: paymentData.currency,
      status: paymentData.status,
      paidAt: paymentData.paid_at,
      channel: paymentData.channel,
      customerEmail: paymentData.customer.email,
      metadata: paymentData.metadata ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { message: "Failed to verify payment." },
      { status: 500 }
    );
  }
}
