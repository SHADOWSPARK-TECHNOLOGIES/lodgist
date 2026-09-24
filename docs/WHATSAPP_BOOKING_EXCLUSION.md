# Booking overlap exclusion

Not applied to production.

## CURRENT INVARIANT

Application code rejects an overlapping `PENDING`, `PENDING_VERIFICATION`, or `CONFIRMED` booking after a `findFirst`. Two commits can both pass that read.

## PROPOSED INVARIANT

PostgreSQL exclusion constraint `booking_no_overlap` on `Booking`: same `listingId` cannot have overlapping `[startDate, endDate)` ranges while status is `PENDING`, `PENDING_VERIFICATION`, or `CONFIRMED`. `CANCELLED` and `COMPLETED` do not block.

## MIGRATION BLAST RADIUS

`packages/db/prisma/migrations/20260924100000_booking_no_overlap/migration.sql` adds extension `btree_gist` and one constraint. It does not rewrite rows. `ADD CONSTRAINT` fails if any current pair already overlaps.

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
