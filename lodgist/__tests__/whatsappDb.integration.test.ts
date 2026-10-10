import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import type { PrismaClient } from "@prisma/client";

const requireFromDb = createRequire(
  new URL("../../packages/db/src/client.js", import.meta.url),
);
const { PrismaClient: PrismaClientCtor } = requireFromDb("@prisma/client") as {
  PrismaClient: new (options: { adapter: PrismaPg }) => PrismaClient;
};
import { handleWhatsAppMessage, type SessionState } from "@/lib/whatsapp/conversation";
import { createPrismaWhatsAppDb } from "@/lib/whatsapp/prismaDb";

const databaseUrl = process.env.LODGIST_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("WhatsApp search and booking against Postgres", () => {
  let prisma: PrismaClient;
  let pool: pg.Pool;
  const phone = "2348099990001";

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl, ssl: false });
    prisma = new PrismaClientCtor({ adapter: new PrismaPg(pool) });
    await prisma.processedWebhookEvent.deleteMany({ where: { id: { startsWith: "whatsapp:" } } });
    await prisma.whatsAppMessage.deleteMany({
      where: { sender: { OR: [{ whatsappId: phone }, { email: "wa-bot@lodgist.local" }] } },
    });
    await prisma.whatsAppSession.deleteMany({
      where: { OR: [{ user: { whatsappId: phone } }, { contact: { email: "wa-bot@lodgist.local" } }] },
    });
    await prisma.booking.deleteMany({ where: { listing: { title: "WA race listing" } } });
    await prisma.listing.deleteMany({ where: { title: { in: ["WA integration listing", "WA race listing"] } } });
    await prisma.property.deleteMany({ where: { address: "Race Flat" } });
    await prisma.booking.deleteMany({ where: { tenant: { whatsappId: phone } } });
    await prisma.listing.deleteMany({ where: { title: "WA integration listing" } });
    await prisma.property.deleteMany({ where: { address: "12 Admiralty Way" } });
    await prisma.user.deleteMany({
      where: { OR: [{ whatsappId: phone }, { email: "wa-landlord@lodgist.local" }] },
    });

    const landlord = await prisma.user.create({
      data: {
        name: "WA Landlord",
        email: "wa-landlord@lodgist.local",
        role: "LANDLORD",
      },
    });
    const property = await prisma.property.create({
      data: {
        ownerId: landlord.id,
        address: "12 Admiralty Way",
        city: "Lekki",
        state: "Lagos",
      },
    });
    await prisma.listing.create({
      data: {
        propertyId: property.id,
        ownerId: landlord.id,
        title: "WA integration listing",
        description: "Local WhatsApp booking fixture",
        price: 1500000,
        status: "VERIFIED",
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.processedWebhookEvent.deleteMany({ where: { id: { startsWith: "whatsapp:wamid.db" } } });
    await prisma.booking.deleteMany({ where: { tenant: { whatsappId: phone } } });
    await prisma.whatsAppMessage.deleteMany({ where: { sender: { whatsappId: phone } } });
    await prisma.whatsAppSession.deleteMany({
      where: { OR: [{ user: { whatsappId: phone } }, { contact: { email: "wa-bot@lodgist.local" } }] },
    });
    await prisma.user.deleteMany({ where: { whatsappId: phone } });
    await prisma.user.deleteMany({ where: { email: "wa-bot@lodgist.local" } });
    await prisma.booking.deleteMany({ where: { listing: { title: "WA race listing" } } });
    await prisma.listing.deleteMany({ where: { title: { in: ["WA integration listing", "WA race listing"] } } });
    await prisma.property.deleteMany({ where: { address: "Race Flat" } });
    await prisma.property.deleteMany({ where: { address: "12 Admiralty Way", owner: { email: "wa-landlord@lodgist.local" } } });
    await prisma.user.deleteMany({ where: { email: "wa-landlord@lodgist.local" } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("searches Lagos, books once, and ignores the duplicate event", async () => {
    const db = createPrismaWhatsAppDb(prisma);
    const state = {
      db,
      sessions: new Map<string, SessionState>(),
      replies: new Map<string, string>(),
    };

    const found = await handleWhatsAppMessage(
      { phone: `+${phone}`, body: "search Lagos", messageId: "wamid.db.search" },
      state,
    );
    expect(found.reply).toContain("12 Admiralty Way");
    const idMatch = found.reply.match(/ID: (\d+)/);
    expect(idMatch).not.toBeNull();
    const listingId = idMatch?.[1] ?? "";

    const booked = await handleWhatsAppMessage(
      { phone: `+${phone}`, body: `book ${listingId}`, messageId: "wamid.db.book" },
      state,
    );
    expect(booked.duplicate).toBe(false);
    const bookingMatch = booked.reply.match(/Booking ID: (\S+)/);
    expect(bookingMatch).not.toBeNull();
    const bookingId = bookingMatch?.[1] ?? "";

    const replay = await handleWhatsAppMessage(
      { phone: `+${phone}`, body: `book ${listingId}`, messageId: "wamid.db.book" },
      { db, sessions: new Map(), replies: new Map() },
    );
    expect(replay.duplicate).toBe(true);

    const status = await handleWhatsAppMessage(
      { phone: `+${phone}`, body: `status ${bookingId}`, messageId: "wamid.db.status" },
      state,
    );
    expect(status.reply).toContain("Status: PENDING");
    expect(status.reply).toContain("12 Admiralty Way");

    const tenant = await prisma.user.findUnique({ where: { whatsappId: phone } });
    const count = await prisma.booking.count({
      where: { tenantId: tenant?.id, sourceChannel: "whatsapp" },
    });
    expect(count).toBe(1);
  });

  it("books option 1 from a draft stored before the session map was dropped", async () => {
    const db = createPrismaWhatsAppDb(prisma);
    const found = await handleWhatsAppMessage(
      { phone: `+${phone}`, body: "search Lagos", messageId: "wamid.db.draft" },
      { db, sessions: new Map(), replies: new Map() },
    );
    expect(found.reply).toMatch(/1\. /);
    const booked = await handleWhatsAppMessage(
      { phone: `+${phone}`, body: "1", messageId: "wamid.db.draft.pick" },
      { db, sessions: new Map(), replies: new Map() },
    );
    expect(booked.reply).toContain("12 Admiralty Way");
    const count = await prisma.booking.count({
      where: { tenant: { whatsappId: phone }, sourceChannel: "whatsapp" },
    });
    expect(count).toBe(1);
  });

  it("hides a listing that is already booked for the requested dates", async () => {
    const guest = "2348099990002";
    const landlord = await prisma.user.findUniqueOrThrow({ where: { email: "wa-landlord@lodgist.local" } });
    const takenOwner = await prisma.user.create({
      data: { name: "Taken Tenant", email: "wa-taken@lodgist.local", role: "TENANT" },
    });
    const openProperty = await prisma.property.create({
      data: { ownerId: landlord.id, address: "Open Flat", city: "Lekki", state: "Lagos" },
    });
    const takenProperty = await prisma.property.create({
      data: { ownerId: landlord.id, address: "Taken Flat", city: "Lekki", state: "Lagos" },
    });
    const openListing = await prisma.listing.create({
      data: {
        propertyId: openProperty.id,
        ownerId: landlord.id,
        title: "WA open listing",
        description: "Free for the requested dates",
        price: 1200000,
        status: "VERIFIED",
      },
    });
    const takenListing = await prisma.listing.create({
      data: {
        propertyId: takenProperty.id,
        ownerId: landlord.id,
        title: "WA taken listing",
        description: "Already booked",
        price: 900000,
        status: "VERIFIED",
      },
    });
    await prisma.booking.create({
      data: {
        listingId: takenListing.id,
        tenantId: takenOwner.id,
        startDate: new Date("2026-10-01T00:00:00.000Z"),
        endDate: new Date("2026-10-05T00:00:00.000Z"),
        totalAmount: 900000,
        status: "CONFIRMED",
        sourceChannel: "direct",
      },
    });

    const db = createPrismaWhatsAppDb(prisma);
    const state = {
      db,
      sessions: new Map<string, SessionState>(),
      replies: new Map<string, string>(),
    };
    const found = await handleWhatsAppMessage(
      {
        phone: `+${guest}`,
        body: "I need a place in Lagos from 2026-10-01 to 2026-10-05",
        messageId: "wamid.db.dates",
      },
      state,
    );
    expect(found.reply).toContain("Open Flat");
    expect(found.reply).not.toContain("Taken Flat");

    const booked = await handleWhatsAppMessage(
      { phone: `+${guest}`, body: "1", messageId: "wamid.db.option" },
      state,
    );
    expect(booked.reply).toContain("2026-10-01");
    expect(booked.reply).toContain("2026-10-05");

    const row = await prisma.booking.findFirst({
      where: { tenant: { whatsappId: guest }, listingId: openListing.id, sourceChannel: "whatsapp" },
    });
    expect(row?.startDate.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(row?.endDate.toISOString().slice(0, 10)).toBe("2026-10-05");

    await prisma.booking.deleteMany({ where: { listingId: { in: [openListing.id, takenListing.id] } } });
    await prisma.listing.deleteMany({ where: { id: { in: [openListing.id, takenListing.id] } } });
    await prisma.property.deleteMany({ where: { id: { in: [openProperty.id, takenProperty.id] } } });
    await prisma.whatsAppMessage.deleteMany({ where: { sender: { whatsappId: guest } } });
    await prisma.whatsAppSession.deleteMany({
      where: { OR: [{ user: { whatsappId: guest } }, { contact: { whatsappId: guest } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: [takenOwner.id] } } });
    await prisma.user.deleteMany({ where: { whatsappId: guest } });
  });
});
