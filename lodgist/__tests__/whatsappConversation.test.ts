import { describe, expect, it } from "vitest";
import {
  handleWhatsAppMessage,
  type BookResult,
  type ListingHit,
  type SessionState,
  type StatusResult,
  type WhatsAppDb,
} from "@/lib/whatsapp/conversation";

function memoryDb(hits: ListingHit[]): WhatsAppDb & { books: number; claims: string[] } {
  const bookings = new Map<string, { phone: string; listingId: number; id: string }>();
  const events = new Set<string>();
  const api = {
    books: 0,
    claims: [] as string[],
    async search(location: string): Promise<ListingHit[]> {
      const needle = location.toLowerCase();
      return hits.filter(
        (hit) =>
          hit.city.toLowerCase().includes(needle) ||
          hit.state.toLowerCase().includes(needle) ||
          hit.address.toLowerCase().includes(needle),
      );
    },
    async book(phone: string, listingId: number): Promise<BookResult> {
      const hit = hits.find((item) => item.listingId === listingId);
      if (!hit) return { ok: false, message: `Listing ${listingId} is not available to book.` };
      const existing = [...bookings.values()].find(
        (row) => row.phone === phone && row.listingId === listingId,
      );
      if (existing) {
        return {
          ok: true,
          bookingId: existing.id,
          status: "PENDING",
          address: hit.address,
          city: hit.city,
          state: hit.state,
          price: hit.price,
          created: false,
        };
      }
      api.books += 1;
      const id = `book_${api.books}`;
      bookings.set(id, { phone, listingId, id });
      return {
        ok: true,
        bookingId: id,
        status: "PENDING",
        address: hit.address,
        city: hit.city,
        state: hit.state,
        price: hit.price,
        created: true,
      };
    },
    async status(bookingId: string): Promise<StatusResult> {
      const row = bookings.get(bookingId);
      if (!row) return { ok: false };
      const hit = hits.find((item) => item.listingId === row.listingId);
      if (!hit) return { ok: false };
      return {
        ok: true,
        bookingId,
        status: "PENDING",
        address: hit.address,
        city: hit.city,
        startDate: new Date("2026-09-24T00:00:00.000Z"),
        endDate: new Date("2027-09-24T00:00:00.000Z"),
      };
    },
    async claimEvent(eventId: string): Promise<"new" | "duplicate"> {
      api.claims.push(eventId);
      if (events.has(eventId)) return "duplicate";
      events.add(eventId);
      return "new";
    },
  };
  return api;
}

const lagos: ListingHit = {
  listingId: 42,
  price: 1500000,
  address: "12 Admiralty Way",
  city: "Lekki",
  state: "Lagos",
};

function deps(db: WhatsAppDb) {
  return {
    db,
    sessions: new Map<string, SessionState>(),
    replies: new Map<string, string>(),
  };
}

describe("local WhatsApp conversation", () => {
  it("searches then books across two turns", async () => {
    const db = memoryDb([lagos]);
    const state = deps(db);

    const prompt = await handleWhatsAppMessage(
      { phone: "whatsapp:+2348011111111", body: "search" },
      state,
    );
    expect(prompt.reply).toContain("Which area");

    const found = await handleWhatsAppMessage(
      { phone: "+2348011111111", body: "Lagos" },
      state,
    );
    expect(found.reply).toContain("ID: 42");

    const booked = await handleWhatsAppMessage(
      { phone: "2348011111111", body: "book 42" },
      state,
    );
    expect(booked.reply).toContain("Booking requested");
    expect(booked.reply).toContain("book_1");
    expect(db.books).toBe(1);

    const status = await handleWhatsAppMessage(
      { phone: "2348011111111", body: "status book_1" },
      state,
    );
    expect(status.reply).toContain("Status: PENDING");
    expect(status.reply).toContain("12 Admiralty Way");
  });

  it("does not book again when the same event is delivered twice", async () => {
    const db = memoryDb([lagos]);
    const state = deps(db);
    const message = {
      phone: "+2348011111111",
      body: "book 42",
      messageId: "wamid.replay",
    };

    const first = await handleWhatsAppMessage(message, state);
    const second = await handleWhatsAppMessage(message, state);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.reply).toBe(first.reply);
    expect(db.books).toBe(1);
    expect(db.claims).toEqual(["wamid.replay"]);
  });

  it("claims the event in the database before a second delivery can book", async () => {
    const db = memoryDb([lagos]);
    const firstState = deps(db);
    const secondState = deps(db);
    const message = {
      phone: "+2348011111111",
      body: "book 42",
      messageId: "SM123",
    };

    await handleWhatsAppMessage(message, firstState);
    const replay = await handleWhatsAppMessage(message, secondState);

    expect(replay.duplicate).toBe(true);
    expect(replay.reply).toContain("already processed");
    expect(db.books).toBe(1);
  });
});
