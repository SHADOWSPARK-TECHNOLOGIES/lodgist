export type SessionStep =
  | "idle"
  | "awaiting_search_location"
  | "awaiting_book_listing_id"
  | "awaiting_status_id";

export interface SessionState {
  step: SessionStep;
}

export interface ListingHit {
  listingId: number;
  price: number;
  address: string;
  city: string;
  state: string;
}

export type BookResult =
  | {
      ok: true;
      bookingId: string;
      status: string;
      address: string;
      city: string;
      state: string;
      price: number;
      created: boolean;
    }
  | { ok: false; message: string };

export type StatusResult =
  | {
      ok: true;
      bookingId: string;
      status: string;
      address: string;
      city: string;
      startDate: Date;
      endDate: Date;
    }
  | { ok: false };

export interface WhatsAppDb {
  search(location: string): Promise<ListingHit[]>;
  book(phone: string, listingId: number): Promise<BookResult>;
  status(bookingId: string): Promise<StatusResult>;
  claimEvent(eventId: string): Promise<"new" | "duplicate">;
}

export interface IncomingMessage {
  phone: string;
  body: string;
  messageId?: string;
}

export interface HandleResult {
  reply: string;
  duplicate: boolean;
}

export interface ConversationDeps {
  db: WhatsAppDb;
  sessions: Map<string, SessionState>;
  replies: Map<string, string>;
}

export function normalizePhone(from: string): string {
  return from.replace(/^whatsapp:/i, "").replace(/[^\d]/g, "");
}

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twimlMessage(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(body)}</Message>
</Response>`;
}

const HELP =
  "Lodgist WhatsApp\n\n" +
  "search [location] — verified listings\n" +
  "book [listing-id] — request that listing\n" +
  "status [booking-id] — booking status\n" +
  "help — this menu";

function formatSearch(location: string, hits: ListingHit[]): string {
  if (hits.length === 0) {
    return `No verified listings in "${location}". Try another area, or send help.`;
  }
  const lines = hits.map((hit, index) => {
    const price = hit.price.toLocaleString("en-NG");
    return `${index + 1}. ${hit.address}, ${hit.city}, ${hit.state} — NGN ${price} (ID: ${hit.listingId})`;
  });
  return `Verified listings in "${location}":\n\n${lines.join("\n")}\n\nReply book [listing-id] to request one.`;
}

function formatBook(result: BookResult): string {
  if (!result.ok) return result.message;
  const price = result.price.toLocaleString("en-NG");
  const verb = result.created ? "Booking requested" : "You already have a booking";
  return (
    `${verb}\n\n` +
    `${result.address}, ${result.city}, ${result.state}\n` +
    `Price: NGN ${price}\n` +
    `Booking ID: ${result.bookingId}\n` +
    `Status: ${result.status}\n\n` +
    `Check it with status ${result.bookingId}`
  );
}

function formatStatus(bookingId: string, result: StatusResult): string {
  if (!result.ok) {
    return `No booking found for "${bookingId}". Use the ID from your book confirmation.`;
  }
  const start = result.startDate.toISOString().slice(0, 10);
  const end = result.endDate.toISOString().slice(0, 10);
  return (
    `Booking ${result.bookingId}\n` +
    `${result.address}, ${result.city}\n` +
    `Status: ${result.status}\n` +
    `Dates: ${start} — ${end}`
  );
}

async function replyForText(
  phone: string,
  text: string,
  deps: ConversationDeps,
): Promise<string> {
  const session = deps.sessions.get(phone) ?? { step: "idle" as const };
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (session.step === "awaiting_search_location") {
    deps.sessions.set(phone, { step: "idle" });
    const hits = await deps.db.search(trimmed);
    return formatSearch(trimmed, hits);
  }
  if (session.step === "awaiting_book_listing_id") {
    deps.sessions.set(phone, { step: "idle" });
    return formatBook(await bookFromText(phone, trimmed, deps));
  }
  if (session.step === "awaiting_status_id") {
    deps.sessions.set(phone, { step: "idle" });
    return formatStatus(trimmed, await deps.db.status(trimmed));
  }

  if (lower === "help" || lower === "menu") {
    deps.sessions.set(phone, { step: "idle" });
    return HELP;
  }
  if (lower === "search") {
    deps.sessions.set(phone, { step: "awaiting_search_location" });
    return "Which area should I search? Send a city, state, or address.";
  }
  if (lower === "book") {
    deps.sessions.set(phone, { step: "awaiting_book_listing_id" });
    return "Send the numeric listing ID from the search results.";
  }
  if (lower === "status") {
    deps.sessions.set(phone, { step: "awaiting_status_id" });
    return "Send the booking ID from your confirmation.";
  }

  const searchMatch = lower.match(/^search\s+(.+)/);
  if (searchMatch) {
    deps.sessions.set(phone, { step: "idle" });
    const location = trimmed.slice(trimmed.indexOf(" ") + 1).trim();
    return formatSearch(location, await deps.db.search(location));
  }

  const bookMatch = lower.match(/^book\s+(.+)/);
  if (bookMatch) {
    deps.sessions.set(phone, { step: "idle" });
    const listingText = trimmed.slice(trimmed.indexOf(" ") + 1).trim();
    return formatBook(await bookFromText(phone, listingText, deps));
  }

  const statusMatch = lower.match(/^status\s+(.+)/);
  if (statusMatch) {
    deps.sessions.set(phone, { step: "idle" });
    const bookingId = trimmed.slice(trimmed.indexOf(" ") + 1).trim();
    return formatStatus(bookingId, await deps.db.status(bookingId));
  }

  deps.sessions.set(phone, { step: "idle" });
  return `I didn't recognise that. Send help for search, book, and status.`;
}

async function bookFromText(
  phone: string,
  listingText: string,
  deps: ConversationDeps,
): Promise<BookResult> {
  const listingId = Number(listingText);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return {
      ok: false,
      message: `"${listingText}" is not a listing ID. Use the number from search.`,
    };
  }
  return deps.db.book(phone, listingId);
}

export async function handleWhatsAppMessage(
  message: IncomingMessage,
  deps: ConversationDeps,
): Promise<HandleResult> {
  const phone = normalizePhone(message.phone);
  if (!phone || !message.body.trim()) {
    return { reply: "Send a text message with a command. Try help.", duplicate: false };
  }

  if (message.messageId) {
    const cached = deps.replies.get(message.messageId);
    if (cached) return { reply: cached, duplicate: true };
    const claim = await deps.db.claimEvent(message.messageId);
    if (claim === "duplicate") {
      return {
        reply: deps.replies.get(message.messageId) ?? "This message was already processed.",
        duplicate: true,
      };
    }
  }

  const reply = await replyForText(phone, message.body, deps);
  if (message.messageId) deps.replies.set(message.messageId, reply);
  return { reply, duplicate: false };
}
