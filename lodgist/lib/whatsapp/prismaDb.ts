import type { PrismaClient } from "@prisma/client";
import type { BookResult, ListingHit, StatusResult, WhatsAppDb } from "./conversation";

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

function whatsappEmail(phone: string): string {
  return `wa.${phone}@lodgist.local`;
}

export function createPrismaWhatsAppDb(prisma: PrismaClient): WhatsAppDb {
  return {
    async search(location: string): Promise<ListingHit[]> {
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
            where: { status: "VERIFIED" },
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

    async book(phone: string, listingId: number): Promise<BookResult> {
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
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);

      const booking =
        existing ??
        (await prisma.booking.create({
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
        }));

      return {
        ok: true,
        bookingId: booking.id,
        status: booking.status,
        address: listing.property.address,
        city: listing.property.city,
        state: listing.property.state,
        price: listing.price,
        created: !existing,
      };
    },

    async status(bookingId: string): Promise<StatusResult> {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
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
      try {
        await prisma.processedWebhookEvent.create({
          data: { id: `whatsapp:${eventId}` },
        });
        return "new";
      } catch (error) {
        if (isUniqueConflict(error)) return "duplicate";
        throw error;
      }
    },
  };
}
