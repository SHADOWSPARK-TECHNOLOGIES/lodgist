---
name: project-state
description: Lodgist sprint state — what's been fixed, what's next, key DB and deploy facts
metadata:
  type: project
---

Sprint 1 complete as of 2026-05-16. The following were fixed:

**Done:**
- Paystack webhook HMAC: `express.raw` now precedes `express.json` in `backend/src/index.js`; `payments.js` uses `Buffer.isBuffer(req.body).toString("utf8")` for raw body
- EscrowTransaction creation added to `lodgist/app/api/payments/initiate/route.ts` — webhook now has a canonical record to update
- DB-backed idempotency: `ProcessedWebhookEvent` model added to `packages/db/prisma/schema.prisma`; uses P2002 unique constraint as atomic idempotency lock; migration `20260516120000_add_processed_webhook_events` applied to local dev DB
- Orphan schema `lodgist/prisma/schema.prisma` deleted; `packages/db/prisma/schema.prisma` is canonical; migration history is in `packages/db/prisma/migrations/`
- Escrow balance-check now fails closed (503) instead of fail-open on Paystack network error

**Local DB state:**
- Host: localhost:5432, DB: lodgist_db, user: lodgist_user, pass: lodgist_pass
- RDS (prod): shadowspark-spine.cgdee2822czx.us-east-1.rds.amazonaws.com — needs same migrations applied via `prisma migrate deploy` with prod DATABASE_URL
- Baseline applied to local DB (two old migrations were created by `db push`, not migrate)

**Next up (per founder's priority):**
1. OAuth: GitHub/Google clientId/Secret (currently empty strings, silent failure)
2. WebAuthn: RP_ID and ORIGIN must be set to prod domain — startup validation needed
3. Two App Runner deploy paths conflict (apprunner.yaml source-based vs CI ECR-based) — pick one
4. Twilio WhatsApp in `lodgist/app/api/whatsapp/webhook/route.ts` is quarantined (410). Meta WhatsApp on `backend/src/routes/whatsapp.js` is authoritative.
5. `PAYSTACK_SECRET_KEY` missing from `lodgist/.env.local` (only `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` is set)

**Why:** All of these are auth/payment/runtime blockers before launch.
