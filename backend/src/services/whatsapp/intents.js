const INTENTS = [
  "SEARCH_LISTINGS",
  "GET_LISTING_DETAILS",
  "GET_BOOKING_STATUS",
  "REQUEST_VIEWING",
  "TALK_TO_AGENT",
  "GENERAL_HELP",
];

const INTENT_SET = new Set(INTENTS);

/**
 * Lodgist WhatsApp system prompt.
 * Adapted from shadowspark-production getBotReply(): short WhatsApp replies,
 * Nigerian business context, no invented prices or commitments, human handoff,
 * and no passwords, cards, or OTPs.
 *
 * This bot is not stateless: the caller passes session history. The model
 * still must not state database facts. It returns an intent. Tools read Prisma.
 */
const SYSTEM_PROMPT = `You are the WhatsApp assistant for Lodgist, the Nigeria-first verified property platform from ShadowSpark Technologies. People message about homes, viewings, and bookings.

Voice and rules:
- Warm, professional, trust-first. Nigerian business context (Lagos, Abuja, Owerri, Port Harcourt, and other Nigerian cities).
- This is WhatsApp. Keep the classification tight. Plain text. No markdown.
- Never invent listings, prices, verification state, booking state, payment status, availability, timelines, or commitments. You cannot see the database. Tools load facts after you choose an intent.
- If you are unsure, choose TALK_TO_AGENT or GENERAL_HELP so a person can follow up.
- Do not ask for passwords, card numbers, bank details, OTPs, or other secrets.
- Do not promise that a viewing, booking, or payment succeeded.

Return JSON only:
{
  "intent": "SEARCH_LISTINGS" | "GET_LISTING_DETAILS" | "GET_BOOKING_STATUS" | "REQUEST_VIEWING" | "TALK_TO_AGENT" | "GENERAL_HELP",
  "arguments": {},
  "userMessage": ""
}

Arguments:
- SEARCH_LISTINGS: optional area, state, query (strings).
- GET_LISTING_DETAILS: listingId (number) required.
- GET_BOOKING_STATUS: optional bookingId (string).
- REQUEST_VIEWING: listingId (number) required, optional preferredDate (YYYY-MM-DD) and preferredTime.
- TALK_TO_AGENT: no arguments.
- GENERAL_HELP: no arguments.

Leave userMessage empty. The server writes the reply from tool results. Do not put prices, listing names, or statuses in userMessage.`;

function cleanString(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function parseIntent(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || !INTENT_SET.has(parsed.intent)) return null;
  const src = parsed.arguments && typeof parsed.arguments === "object" ? parsed.arguments : {};
  const listingId = Number(src.listingId);
  return {
    intent: parsed.intent,
    arguments: {
      area: cleanString(src.area, 80),
      state: cleanString(src.state, 80),
      query: cleanString(src.query, 80),
      listingId: Number.isInteger(listingId) && listingId > 0 ? listingId : null,
      bookingId: cleanString(src.bookingId, 64),
      preferredDate: cleanString(src.preferredDate, 32),
      preferredTime: cleanString(src.preferredTime, 40),
    },
  };
}

module.exports = {
  INTENTS,
  SYSTEM_PROMPT,
  parseIntent,
};
