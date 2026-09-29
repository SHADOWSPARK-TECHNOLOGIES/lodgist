import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

function supportWhatsAppUrl(text: string): string | null {
  const digits = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// ─── POST /api/payments/verify ───────────────────────────────────────────────
// Automated Paystack verification is temporarily replaced by a support handoff.
// Tenants are directed to WhatsApp to confirm payment status with the team.

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const supportUrl = supportWhatsAppUrl(
    "Hi Lodgist Support, I need to verify the status of my payment. Please assist."
  );

  return NextResponse.json({
    mode: "support",
    message:
      "Automated payment verification is temporarily unavailable. Contact support to confirm your payment status.",
    supportUrl,
  });
}
