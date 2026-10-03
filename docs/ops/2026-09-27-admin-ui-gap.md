# A+ Gap — Admin Payment Verification UI (confirmed 2026-09-27)

## Finding
The admin dashboard exists at `lodgist/app/dashboard/admin/page.tsx` but is stats-only:
- Stats cards (listings, flagged, pending verifications, bookings, users)
- Listings-per-state chart
- Recent bookings table (last 8) — read-only, no action column

There is **no UI** to:
- View the bookings queue with `PENDING_VERIFICATION` filter
- See `manualPaymentRef` on a booking
- Approve/reject a manual payment via `PATCH /api/bookings/:id/verify-payment`
- Mark a booking `CONFIRMED` from the admin interface

The backend routes are wired and ready:
- `PATCH /api/bookings/:id/manual-payment` — tenant or admin submits bank-transfer ref → `PENDING_VERIFICATION`
- `PATCH /api/bookings/:id/verify-payment` — admin-only, `action: approve` → `CONFIRMED`, sets `verifiedBy`, `verifiedAt`

## A+ criterion
An A+ admin operations surface lets a `STUDIO_ADMIN` see every booking in `PENDING_VERIFICATION`, read the `manualPaymentRef`, and approve/reject with one action, with the action logged to `AdminAction` or equivalent audit trail.

## Gap
Missing: `lodgist/app/dashboard/admin/bookings/` page (or `bookings/[id]/` detail) that calls the verify-payment route. This is the only thing between "backend ready" and "admin can collect revenue without curl."

## Owner
Founder decision on commission structure first (T1.3), then build. The page is a half-day Next.js app-router page with a server fetch to `GET /api/bookings?status=PENDING_VERIFICATION` and a form/button that POSTs `PATCH /api/bookings/:id/verify-payment`.

## Status
Confirmed 2026-09-27 by grep across `frontend/src/` and `lodgist/` (excluding `node_modules`). Zero hits for `verify-payment` or `manual-payment` in any `.ts/.tsx/.js/.jsx` file.
