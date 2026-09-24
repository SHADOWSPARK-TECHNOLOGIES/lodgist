import { describe, expect, it } from "vitest";
import {
  handleWhatsAppMessage,
  type BookResult,
  type ListingHit,
  type SessionState,
  type StatusResult,
  type WhatsAppDb,
} from "@/lib/whatsapp/conversation";

function memoryDb(
  hits: ListingHit[],
  blocked: Array<{ listingId: number; start: string; end: string }> = [],
): WhatsAppDb & { books: number; claims: string[]; lastStay?: { start: string; end: string } } {
  const bookings = new Map<string, { phone: string; listingId: number; id: string }>();
  const events = new Set<string>();
  const api = {
    books: 0,
    claims: [] as string[],
    lastStay: undefined as { start: string; end: string } | undefined,
    async search(location: string, stay?: { start: Date; end: Date }): Promise<ListingHit[]> {
      const needle = location.toLowerCase();
      return hits.filter((hit) => {
        const matches =
          hit.city.toLowerCase().includes(needle) ||
          hit.state.toLowerCase().includes(needle) ||
          hit.address.toLowerCase().includes(needle);
        if (!matches) return false;
        if (!stay) return true;
        return !blocked.some(
          (block) =>
            block.listingId === hit.listingId &&
            stay.start < new Date(`${block.end}T00:00:00.000Z`) &&
            stay.end > new Date(`${block.start}T00:00:00.000Z`),
        );
      });
    },
    async book(phone: string, listingId: number, stay?: { start: Date; end: Date }): Promise<BookResult> {
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
      if (stay) {
        api.lastStay = {
          start: stay.start.toISOString().slice(0, 10),
          end: stay.end.toISOString().slice(0, 10),
        };
      }
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
        startDate: stay?.start,
        endDate: stay?.end,
      };
    },
    async status(phone: string, bookingId: string): Promise<StatusResult> {
      const row = bookings.get(bookingId);
      if (!row || row.phone !== phone) return { ok: false };
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
      if (events.has(eventId)) {
        const error = new Error("unique") as Error & { code: string };
        error.code = "P2002";
        throw error;
      }
      events.add(eventId);
      return "new";
    },
    async inTransaction<T>(fn: (db: WhatsAppDb) => Promise<T>): Promise<T> {
      const before = new Set(events);
      try {
        return await fn(api);
      } catch (error) {
        for (const id of events) {
          if (!before.has(id)) events.delete(id);
        }
        throw error;
      }
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

const taken: ListingHit = {
  listingId: 7,
  price: 900000,
  address: "Taken Flat",
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

  it("books a numbered option from a dated natural-language request", async () => {
    const db = memoryDb([taken, lagos], [
      { listingId: 7, start: "2026-10-01", end: "2026-10-05" },
    ]);
    const state = deps(db);

    const found = await handleWhatsAppMessage(
      {
        phone: "+2348011111111",
        body: "I need a place in Lagos from 2026-10-01 to 2026-10-05",
      },
      state,
    );
    expect(found.reply).toContain("1. 12 Admiralty Way");
    expect(found.reply).not.toContain("Taken Flat");

    const booked = await handleWhatsAppMessage(
      { phone: "+2348011111111", body: "1" },
      state,
    );
    expect(booked.reply).toContain("Booking requested");
    expect(booked.reply).toContain("2026-10-01");
    expect(booked.reply).toContain("2026-10-05");
    expect(db.books).toBe(1);
    expect(db.lastStay).toEqual({ start: "2026-10-01", end: "2026-10-05" });
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

  it("rejects a date that is not a real calendar day", async () => {
    const db = memoryDb([lagos]);
    const found = await handleWhatsAppMessage(
      {
        phone: "+2348011111111",
        body: "I need a place in Lagos from 2026-02-31 to 2026-03-02",
      },
      deps(db),
    );
    expect(found.reply).toContain("End date must be after the start date");
    expect(db.books).toBe(0);
  });

  it("does not show another guest's booking", async () => {
    const db = memoryDb([lagos]);
    const state = deps(db);
    await handleWhatsAppMessage({ phone: "+2348011111111", body: "book 42" }, state);
    const other = await handleWhatsAppMessage(
      { phone: "+2348022222222", body: "status book_1" },
      state,
    );
    expect(other.reply).toContain("No booking found");
  });

  it("releases the message id when booking throws", async () => {
    const db = memoryDb([lagos]);
    const state = deps(db);
    const book = db.book.bind(db);
    db.book = async () => {
      throw new Error("db down");
    };
    await expect(
      handleWhatsAppMessage(
        { phone: "+2348011111111", body: "book 42", messageId: "wamid.fail" },
        state,
      ),
    ).rejects.toThrow("db down");

    db.book = book;
    const retry = await handleWhatsAppMessage(
      { phone: "+2348011111111", body: "book 42", messageId: "wamid.fail" },
      state,
    );
    expect(retry.duplicate).toBe(false);
    expect(retry.reply).toContain("Booking requested");
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
