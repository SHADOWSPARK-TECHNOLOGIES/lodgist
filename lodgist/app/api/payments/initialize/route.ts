import { NextResponse } from "next/server";

const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";

// POST /api/payments/initialize
// Phase 4 placeholder — real Paystack initialize flow goes here when PAYMENTS_ENABLED=true.
export async function POST() {
  if (!PAYMENTS_ENABLED) {
    return NextResponse.json(
      { status: "coming_soon", message: "Payments launching soon" },
      { status: 200 }
    );
  }

  // Phase 4: Paystack initialize flow
  return NextResponse.json(
    { message: "Payment initialization not yet implemented." },
    { status: 501 }
  );
}
