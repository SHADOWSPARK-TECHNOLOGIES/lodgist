import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";

const SUPPORT_WHATSAPP =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace("+", "") ?? "2348000000000";

// ─── POST /api/payments/verify ───────────────────────────────────────────────
// Automated Paystack verification is temporarily replaced by a support handoff.
// Tenants are directed to WhatsApp to confirm payment status with the team.

export async function POST(req: NextRequest) {
  if (!PAYMENTS_ENABLED) {
    return NextResponse.json(
      { status: "coming_soon", message: "Payments launching soon" },
      { status: 200 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const supportUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    "Hi Lodgist Support, I need to verify the status of my payment. Please assist."
  )}`;

  return NextResponse.json({
    mode: "support",
    message:
      "Automated payment verification is temporarily unavailable. Contact support to confirm your payment status.",
    supportUrl,
  });
}
