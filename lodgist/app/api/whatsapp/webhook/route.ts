import { NextResponse } from "next/server";

// Retired. Meta WhatsApp Cloud API is served by the Express route
// GET/POST /api/whatsapp/webhook (backend/src/routes/whatsapp.js).
// This Next.js handler must not answer Twilio or any other provider.

export const dynamic = "force-dynamic";

function retired() {
  return NextResponse.json(
    { error: "This WhatsApp webhook is retired. Use the Lodgist API WhatsApp webhook." },
    { status: 410 }
  );
}

export function GET() {
  return retired();
}

export function POST() {
  return retired();
}
