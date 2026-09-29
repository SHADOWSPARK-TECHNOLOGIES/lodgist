import { NextResponse } from "next/server";

/**
 * Quarantined Twilio webhook.
 *
 * This Next.js route used to accept Twilio form posts and reply with TwiML.
 * It is disabled: it does not read the body, touch the database, or send a
 * message.
 *
 * Meta WhatsApp is authoritative. It lives on the API service, not in this
 * Next app:
 *   backend/src/routes/whatsapp.js
 *   GET  /api/whatsapp/webhook — Meta hub verification
 *   POST /api/whatsapp/webhook — incoming Meta messages
 * mounted from backend/src/index.js.
 *
 * Do not restore Twilio handling here.
 */

const DISABLED = {
  success: false,
  error: "WHATSAPP_ROUTE_DISABLED",
  message:
    "This Twilio webhook is disabled. Meta WhatsApp is handled by the Lodgist API at /api/whatsapp/webhook.",
};

export function GET() {
  return NextResponse.json(DISABLED, { status: 410 });
}

export function POST() {
  return NextResponse.json(DISABLED, { status: 410 });
}
