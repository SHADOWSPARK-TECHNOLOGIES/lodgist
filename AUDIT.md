# Rental Safety Check — Phase 0 audit

Recorded before product changes on `main` @ `93fbe2ac` (origin/main matched).

## Where the live product is

- Live site is `frontend/` (https://lodgist.online). Do not treat `lodgist/` as the live app.
- Live API is `backend/` (Express) using `packages/db` Prisma via `packages/db/src/client.js`.
- Canonical schema: `packages/db/prisma/schema.prisma`. Migrations are SQL files under `packages/db/prisma/migrations/`.
- `packages/ai-core/prisma/schema.prisma` is a second schema and was not used for this workflow.

## Reuse map

| Need | Existing piece | Decision |
| --- | --- | --- |
| Customer intake pattern | `POST /api/advertiser-leads`, `POST /api/leads` | New `RentalCheck` route. Do not overload advertiser intake. |
| Paystack | `backend/src/services/paystackService.js`, `POST /api/payments/webhook` HMAC + `ProcessedWebhookEvent` | Reuse initialize/verify and the webhook. Do not trust redirect query params. |
| WhatsApp | `backend/src/routes/whatsapp.js` HMAC + `msg.id` dedupe | Add CHECK / STATUS / REPORT / HELP without weakening signature or dedupe. |
| Spatial Lab | `frontend/src/lib/spatialLab.js` | Do not geocode a free-text location. Neighborhood stays "unavailable" unless a reviewer attaches a labelled note. |
| Screenshots | No upload path on the live API | Not accepted in this pilot. |
| Admin auth | JWT + `requireRole("STUDIO_ADMIN")` | Same gate for review and metrics. |
| Homepage | `frontend/src/app/page.tsx` | Primary CTA added. Browse and advertise links stay. |

## Baseline (pre-change)

| Check | Result |
| --- | --- |
| `frontend` `npx tsc --noEmit` | pass |
| `frontend` `npm test` | 19 pass, 0 fail |
| `frontend` `npm run build` | pass (14 routes) |
| `backend` `npm test` | 101 pass, 0 fail |
| Database migration | not run |
| Production deploy | not run |

No pre-existing failures in those commands.

## Env names in this workspace

All MISSING here: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PUBLIC_URL`, `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `CORS_ORIGIN`.

Payment and WhatsApp send stay fail-closed when those names are unset. Values were not printed.
