import type { PrismaClient } from "@prisma/client";
import type { BookResult, ListingHit, SessionState, StatusResult, Stay, WhatsAppDb } from "./conversation";

const BOT_EMAIL = "wa-bot@lodgist.local";

const BLOCKING_BOOKING = ["PENDING", "PENDING_VERIFICATION", "CONFIRMED"] as const;

function overlapWhere(stay: Stay) {
  return {
    status: { in: [...BLOCKING_BOOKING] },
    startDate: { lt: stay.end },
    endDate: { gt: stay.start },
  };
}

function isExclusionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string; meta?: { code?: string } };
  const message = record.message ?? "";
  return (
    record.code === "23P01" ||
    record.meta?.code === "23P01" ||
    message.includes("23P01") ||
    message.includes("booking_no_overlap")
  );
}

function whatsappEmail(phone: string): string {
  return `wa.${phone}@lodgist.local`;
}

export function createPrismaWhatsAppDb(prisma: PrismaClient): WhatsAppDb {
  return {
    async search(location: string, stay?: Stay): Promise<ListingHit[]> {
      const terms = location.split(/\s+/).filter(Boolean);
      if (terms.length === 0) return [];

      const properties = await prisma.property.findMany({
        where: {
          AND: [
            { listings: { some: { status: "VERIFIED" } } },
            {
              OR: terms.flatMap((term) => [
                { state: { contains: term, mode: "insensitive" } },
                { city: { contains: term, mode: "insensitive" } },
                { address: { contains: term, mode: "insensitive" } },
              ]),
            },
          ],
        },
        include: {
          listings: {
            where: {
              status: "VERIFIED",
              ...(stay ? { bookings: { none: overlapWhere(stay) } } : {}),
            },
            select: { id: true, price: true },
            orderBy: { id: "asc" },
            take: 1,
          },
        },
        take: 5,
      });

      return properties.flatMap((property) => {
        const listing = property.listings[0];
        if (!listing) return [];
        return [
          {
            listingId: listing.id,
            price: listing.price,
            address: property.address,
            city: property.city,
            state: property.state,
          },
        ];
      });
    },

    async book(phone: string, listingId: number, stay?: Stay): Promise<BookResult> {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { property: true },
      });
      if (!listing || listing.status !== "VERIFIED" || !listing.property) {
        return { ok: false, message: `Listing ${listingId} is not available to book.` };
      }

      const tenant = await prisma.user.upsert({
        where: { whatsappId: phone },
        create: {
          name: `WhatsApp ${phone}`,
          email: whatsappEmail(phone),
          phone: `+${phone}`,
          whatsappId: phone,
          role: "TENANT",
        },
        update: {},
      });

      if (listing.ownerId === tenant.id || listing.property.ownerId === tenant.id) {
        return { ok: false, message: "You cannot book your own listing." };
      }

      const existing = await prisma.booking.findFirst({
        where: {
          listingId,
          tenantId: tenant.id,
          status: { not: "CANCELLED" },
        },
      });
      const startDate = stay?.start ?? new Date();
      const endDate = stay?.end ?? new Date(startDate);
      if (!stay) endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);

      if (!existing) {
        const clash = await prisma.booking.findFirst({
          where: { listingId, ...overlapWhere({ start: startDate, end: endDate }) },
        });
        if (clash) {
          return { ok: false, message: `Listing ${listingId} is not available for those dates.` };
        }
      }

      let booking = existing;
      if (!booking) {
        try {
          booking = await prisma.booking.create({
            data: {
              listingId,
              tenantId: tenant.id,
              startDate,
              endDate,
              totalAmount: listing.price,
              status: "PENDING",
              sourceChannel: "whatsapp",
              notes: `WhatsApp booking from +${phone}`,
            },
          });
        } catch (error) {
          if (!isExclusionConflict(error)) throw error;
          return { ok: false, message: `Listing ${listingId} is not available for those dates.` };
        }
      }

      return {
        ok: true,
        bookingId: booking.id,
        status: booking.status,
        address: listing.property.address,
        city: listing.property.city,
        state: listing.property.state,
        price: listing.price,
        created: !existing,
        startDate: booking.startDate,
        endDate: booking.endDate,
      };
    },

    async status(phone: string, bookingId: string): Promise<StatusResult> {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, tenant: { whatsappId: phone } },
        include: {
          listing: {
            select: { property: { select: { address: true, city: true } } },
          },
        },
      });
      if (!booking?.listing.property) return { ok: false };
      return {
        ok: true,
        bookingId: booking.id,
        status: booking.status,
        address: booking.listing.property.address,
        city: booking.listing.property.city,
        startDate: booking.startDate,
        endDate: booking.endDate,
      };
    },

    async claimEvent(eventId: string): Promise<"new" | "duplicate"> {
      await prisma.processedWebhookEvent.create({
        data: { id: `whatsapp:${eventId}` },
      });
      return "new";
    },

    async saveDraft(phone: string, draft: SessionState): Promise<void> {
      const guest = await prisma.user.upsert({
        where: { whatsappId: phone },
        create: {
          name: `WhatsApp ${phone}`,
          email: whatsappEmail(phone),
          phone: `+${phone}`,
          whatsappId: phone,
          role: "TENANT",
        },
        update: {},
      });
      const bot = await prisma.user.upsert({
        where: { email: BOT_EMAIL },
        create: { name: "Lodgist WhatsApp", email: BOT_EMAIL, role: "TENANT" },
        update: {},
      });
      const existing = await prisma.whatsAppSession.findFirst({
        where: { userId: guest.id, contactId: bot.id, platform: "whatsapp" },
      });
      const session =
        existing ??
        (await prisma.whatsAppSession.create({
          data: { userId: guest.id, contactId: bot.id, platform: "whatsapp" },
        }));
      await prisma.whatsAppMessage.create({
        data: {
          sessionId: session.id,
          senderId: guest.id,
          content: draft.stay ? `${draft.stay.start} ${draft.stay.end}` : "search",
          direction: "INBOUND",
          metadata: {
            kind: "whatsapp-draft",
            stage: draft.step,
            // Spread to plain objects so they type-check as Prisma JSON (interfaces lack an index signature).
            options: (draft.options ?? []).map(({ listingId, price, address, city, state }) => ({ listingId, price, address, city, state })),
            stay: draft.stay ? { start: draft.stay.start, end: draft.stay.end } : null,
            guestCount: null,
          },
        },
      });
    },

    async loadDraft(phone: string): Promise<SessionState | null> {
      const message = await prisma.whatsAppMessage.findFirst({
        where: {
          session: { user: { whatsappId: phone }, platform: "whatsapp" },
          direction: "INBOUND",
        },
        orderBy: { sentAt: "desc" },
      });
      const metadata = message?.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
      const record = metadata as {
        kind?: string;
        stage?: SessionState["step"];
        options?: ListingHit[];
        stay?: { start: string; end: string } | null;
      };
      if (record.kind !== "whatsapp-draft" || !record.stage) return null;
      return { step: record.stage, options: record.options ?? [], stay: record.stay ?? undefined };
    },

    async inTransaction<T>(fn: (db: WhatsAppDb) => Promise<T>): Promise<T> {
      return prisma.$transaction((tx) => fn(createPrismaWhatsAppDb(tx as PrismaClient)));
    },
  };
}
