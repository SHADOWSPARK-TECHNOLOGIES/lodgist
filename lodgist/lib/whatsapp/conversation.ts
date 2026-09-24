export type SessionStep =
  | "idle"
  | "awaiting_search_location"
  | "awaiting_book_listing_id"
  | "awaiting_status_id";

export interface Stay {
  start: Date;
  end: Date;
}

export interface SessionState {
  step: SessionStep;
  options?: ListingHit[];
  stay?: { start: string; end: string };
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
      startDate?: Date;
      endDate?: Date;
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
  search(location: string, stay?: Stay): Promise<ListingHit[]>;
  book(phone: string, listingId: number, stay?: Stay): Promise<BookResult>;
  status(phone: string, bookingId: string): Promise<StatusResult>;
  claimEvent(eventId: string): Promise<"new" | "duplicate">;
  inTransaction<T>(fn: (db: WhatsAppDb) => Promise<T>): Promise<T>;
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
  return `Verified listings in "${location}":\n\n${lines.join("\n")}\n\nReply with a number to book, or book [listing-id].`;
}

function formatSearchDated(location: string, hits: ListingHit[], stay?: { start: string; end: string }): string {
  const body = formatSearch(location, hits);
  if (!stay || hits.length === 0) {
    return stay && hits.length === 0
      ? `No verified listings available in "${location}" from ${stay.start} to ${stay.end}.`
      : body;
  }
  return body.replace(
    `Verified listings in "${location}":`,
    `Available in "${location}" from ${stay.start} to ${stay.end}:`,
  );
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
    `Status: ${result.status}` +
    (result.startDate && result.endDate
      ? `\nDates: ${result.startDate.toISOString().slice(0, 10)} — ${result.endDate.toISOString().slice(0, 10)}`
      : "") +
    `\n\nCheck it with status ${result.bookingId}`
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

const DATE_STOP = new Set(["from", "to", "until", "between", "for", "on", "please", "with", "and"]);

function parseStay(text: string): { stay?: { start: string; end: string }; invalid: boolean } {
  const dates = text.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  if (dates.length < 2) return { invalid: false };
  const start = utcDay(dates[0]);
  const end = utcDay(dates[1]);
  if (!start || !end || end <= start) return { invalid: true };
  return { stay: { start: dates[0], end: dates[1] }, invalid: false };
}

function parsePlace(text: string): string | undefined {
  const match = text.match(/\b(?:in|at|near)\s+(.+)/i);
  if (!match?.[1]) return undefined;
  const words = match[1]
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .split(/[^A-Za-z]+/)
    .filter((word) => word && !DATE_STOP.has(word.toLowerCase()));
  if (words.length === 0) return undefined;
  return words.slice(0, 3).join(" ");
}

function utcDay(iso: string): Date | undefined {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return undefined;
  return date;
}

function stayDates(stay?: { start: string; end: string }): Stay | undefined {
  if (!stay) return undefined;
  return {
    start: new Date(`${stay.start}T00:00:00.000Z`),
    end: new Date(`${stay.end}T00:00:00.000Z`),
  };
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
    return searchAndRemember(phone, trimmed, deps);
  }
  if (session.step === "awaiting_book_listing_id") {
    deps.sessions.set(phone, { step: "idle" });
    return formatBook(await bookFromText(phone, trimmed, deps));
  }
  if (session.step === "awaiting_status_id") {
    deps.sessions.set(phone, { step: "idle" });
    return formatStatus(trimmed, await deps.db.status(phone, trimmed));
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
    const location = trimmed.slice(trimmed.indexOf(" ") + 1).trim();
    return searchAndRemember(phone, location, deps);
  }

  const bookMatch = lower.match(/^book\s+(.+)/);
  if (bookMatch) {
    deps.sessions.set(phone, { step: "idle" });
    const listingText = trimmed.slice(trimmed.indexOf(" ") + 1).trim();
    return formatBook(await bookFromText(phone, listingText, deps));
  }

  const statusMatch = lower.match(/^status\s+(.+)/);
  if (statusMatch) {
    deps.sessions.set(phone, { step: "idle", options: session.options, stay: session.stay });
    const bookingId = trimmed.slice(trimmed.indexOf(" ") + 1).trim();
    return formatStatus(bookingId, await deps.db.status(phone, bookingId));
  }

  const choice = trimmed.match(/^\d+$/);
  if (choice && session.options && session.options.length > 0) {
    const index = Number(choice[0]) - 1;
    const hit = session.options[index];
    if (!hit) return `Reply with a number from 1 to ${session.options.length}.`;
    const result = await deps.db.book(phone, hit.listingId, stayDates(session.stay));
    if (result.ok) deps.sessions.set(phone, { step: "idle" });
    return formatBook(result);
  }

  const place = parsePlace(trimmed);
  if (place) {
    const parsed = parseStay(trimmed);
    if (parsed.invalid) return "End date must be after the start date. Use YYYY-MM-DD.";
    return searchAndRemember(phone, place, deps, parsed.stay);
  }

  deps.sessions.set(phone, { step: "idle" });
  return `I didn't recognise that. Send help for search, book, and status.`;
}

async function searchAndRemember(
  phone: string,
  location: string,
  deps: ConversationDeps,
  stay?: { start: string; end: string },
): Promise<string> {
  const hits = await deps.db.search(location, stayDates(stay));
  deps.sessions.set(phone, { step: "idle", options: hits, stay });
  return formatSearchDated(location, hits, stay);
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

  if (!message.messageId) {
    return { reply: await replyForText(phone, message.body, deps), duplicate: false };
  }

  const cached = deps.replies.get(message.messageId);
  if (cached) return { reply: cached, duplicate: true };

  try {
    return await deps.db.inTransaction(async (db) => {
      const claim = await db.claimEvent(message.messageId as string);
      if (claim === "duplicate") {
        return {
          reply: deps.replies.get(message.messageId as string) ?? "This message was already processed.",
          duplicate: true,
        };
      }
      const reply = await replyForText(phone, message.body, { ...deps, db });
      deps.replies.set(message.messageId as string, reply);
      return { reply, duplicate: false };
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      return {
        reply: deps.replies.get(message.messageId) ?? "This message was already processed.",
        duplicate: true,
      };
    }
    throw error;
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}
