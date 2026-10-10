# Booking overlap exclusion

Not applied to production.

## CURRENT INVARIANT

Application code rejects an overlapping `PENDING`, `PENDING_VERIFICATION`, or `CONFIRMED` booking after a `findFirst`. Two commits can both pass that read.

## PROPOSED INVARIANT

PostgreSQL exclusion constraint `booking_no_overlap` on `Booking`: same `listingId` cannot have overlapping `[startDate, endDate)` ranges while status is `PENDING`, `PENDING_VERIFICATION`, or `CONFIRMED`. `CANCELLED` and `COMPLETED` do not block.

## MIGRATION BLAST RADIUS

`packages/db/prisma/migrations/20261010120000_booking_no_overlap/migration.sql` adds extension `btree_gist` and one constraint. It does not rewrite rows. `ADD CONSTRAINT` fails if any current pair already overlaps.

## PRODUCTION PRECHECK

```sql
SELECT a.id, b.id, a."listingId"
FROM "Booking" a
JOIN "Booking" b
  ON a."listingId" = b."listingId"
 AND a.id < b.id
 AND a.status IN ('PENDING', 'PENDING_VERIFICATION', 'CONFIRMED')
 AND b.status IN ('PENDING', 'PENDING_VERIFICATION', 'CONFIRMED')
 AND tsrange(a."startDate", a."endDate", '[)') && tsrange(b."startDate", b."endDate", '[)');
```

Apply only when that query returns no rows. Requires permission to `CREATE EXTENSION btree_gist`.

## ROLLBACK

```sql
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_no_overlap;
```

Leaving `btree_gist` installed is harmless. Dropping it is a separate decision if nothing else uses it.

## Race test

The DB-level race test, "lets only one of two concurrent bookings keep an overlapping stay", was taken out of #77 together with this migration. Add it back to `lodgist/__tests__/whatsappDb.integration.test.ts` after #77 merges. It runs only when `LODGIST_TEST_DATABASE_URL` is set. This is the test:

```ts

  it("lets only one of two concurrent bookings keep an overlapping stay", async () => {
    const landlord = await prisma.user.findUniqueOrThrow({ where: { email: "wa-landlord@lodgist.local" } });
    const property = await prisma.property.create({
      data: { ownerId: landlord.id, address: "Race Flat", city: "Lekki", state: "Lagos" },
    });
    const listing = await prisma.listing.create({
      data: {
        propertyId: property.id,
        ownerId: landlord.id,
        title: "WA race listing",
        description: "Concurrency fixture",
        price: 500000,
        status: "VERIFIED",
      },
    });
    const stay = {
      start: new Date("2026-11-01T00:00:00.000Z"),
      end: new Date("2026-11-05T00:00:00.000Z"),
    };
    await prisma.$executeRawUnsafe(`ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_no_overlap`);
    await prisma.booking.deleteMany({
      where: { tenant: { whatsappId: { in: ["2348099990101", "2348099990102"] } } },
    });
    await prisma.user.deleteMany({
      where: { whatsappId: { in: ["2348099990101", "2348099990102"] } },
    });
    const guestA = await prisma.user.create({
      data: { name: "Race A", email: "wa-race-a@lodgist.local", whatsappId: "2348099990101", role: "TENANT" },
    });
    const guestB = await prisma.user.create({
      data: { name: "Race B", email: "wa-race-b@lodgist.local", whatsappId: "2348099990102", role: "TENANT" },
    });
    const openRows = await Promise.all([
      prisma.booking.create({
        data: {
          listingId: listing.id,
          tenantId: guestA.id,
          startDate: stay.start,
          endDate: stay.end,
          totalAmount: 500000,
          status: "PENDING",
          sourceChannel: "whatsapp",
        },
      }),
      prisma.booking.create({
        data: {
          listingId: listing.id,
          tenantId: guestB.id,
          startDate: stay.start,
          endDate: stay.end,
          totalAmount: 500000,
          status: "PENDING",
          sourceChannel: "whatsapp",
        },
      }),
    ]);
    expect(openRows).toHaveLength(2);

    await prisma.booking.deleteMany({ where: { listingId: listing.id } });
    const sql = readFileSync(
      new URL(
        "../../packages/db/prisma/migrations/20261010120000_booking_no_overlap/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }

    const guarded = createPrismaWhatsAppDb(prisma);
    const guardedResults = await Promise.all([
      guarded.book("2348099990101", listing.id, stay),
      guarded.book("2348099990102", listing.id, stay),
    ]);
    expect(guardedResults.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.booking.count({ where: { listingId: listing.id } })).toBe(1);

    await prisma.booking.deleteMany({ where: { listingId: listing.id } });
    await prisma.user.deleteMany({ where: { whatsappId: { in: ["2348099990101", "2348099990102"] } } });
    await prisma.listing.delete({ where: { id: listing.id } });
    await prisma.property.delete({ where: { id: property.id } });
  });
```
