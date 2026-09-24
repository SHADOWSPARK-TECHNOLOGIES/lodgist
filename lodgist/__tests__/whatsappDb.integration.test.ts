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
    await prisma.user.deleteMany({ where: { whatsappId: phone } });
    await prisma.listing.deleteMany({ where: { title: "WA integration listing" } });
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
});
