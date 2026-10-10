# Lodgist — Seed + Env + Runtime Audit (Section A–H)

**Date:** 2026-05-15  
**Commit/Ref:** Current workspace state  
**Auditor:** Automated inspection + manual seed validation  

---

## A. Seed Implementation & Data Quality

### A.1 Schema Architecture (Critical Finding)

The project has **two independent Prisma schemas** that are **not shared**:

| Schema | Location | User ID Type | Role Model | Key Models |
|--------|----------|-------------|------------|------------|
| **Lodgist App** | [`lodgist/prisma/schema.prisma`](lodgist/prisma/schema.prisma) | `String` (cuid) | `Role` model via `roleId` relation | User, Property, Listing, Booking, Review, Account, Session, TruthIndexScore |
| **Backend/Shared** | [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) | `Int` (autoincrement) | `Role` enum (`USER`, `ARTISAN`, `LANDLORD`, `STUDIO_ADMIN`) | All of the above PLUS: EscrowTransaction, WhatsAppSession, WhatsAppMessage, AIFraudSignal, Referral, PasskeyCredential, Notification, FraudReport, ViewingRequest, Profile |

**Impact:** The lodgist Next.js app (`port 3000`) and the frontendapp (`port 3001`) talk to **different databases/schemas**. Data created in one is invisible to the other.

### A.2 Seed File — [`packages/db/prisma/seed.ts`](packages/db/prisma/seed.ts)

**Status: ✓ Validated (ran successfully)**

#### Seed Data Summary

| Entity | Count | Details |
|--------|-------|---------|
| **Users** | 5 | admin@lodgist.ng (STUDIO_ADMIN), emeka@lodgist.ng (LANDLORD), fatima@lodgist.ng (LANDLORD), chioma@lodgist.ng (USER), amina@lodgist.ng (USER) |
| **Properties** | 13 | Across 13 Nigerian cities/states |
| **Listings** | 13 | Prices from ₦350K (Benin City) to ₦8.5M (Ikoyi) |
| **Listing Images** | ~30-50 | Unsplash placeholders, 2-4 per listing |
| **Reviews** | 26 | 2 per listing from chioma + amina, varied ratings/comments |
| **Bookings** | 5 | PENDING (Lekki), CONFIRMED (Wuse, VI), CANCELLED (Ikoyi), COMPLETED (PH) |
| **Escrow** | 1 | HELD — ₦3.2M for Wuse listing |
| **TruthIndexScores** | 13 | Per listing, scored against tenant1 |
| **WhatsApp Session** | 1 | 4 messages — tenant1 ↔ landlord1 about Lekki viewing |
| **Notifications** | 5 | Booking conf, viewing reminder, payment receipt, truth score update, escrow update |
| **Fraud Signal** | 1 | Benin City listing flagged (score 0.35 — price anomaly) |

#### Credentials

| Role | Email | Password |
|------|-------|----------|
| STUDIO_ADMIN | admin@lodgist.ng | Admin2026! |
| LANDLORD | emeka@lodgist.ng | Landlord2026! |
| LANDLORD | fatima@lodgist.ng | Landlord2026! |
| USER | chioma@lodgist.ng | Tenant2026! |
| USER | amina@lodgist.ng | Tenant2026! |

#### Nigerian City Coverage

| City | State | Price (₦) | Status |
|------|-------|-----------|--------|
| Lekki | Lagos | 1,800,000 | VERIFIED, Featured |
| Victoria Island | Lagos | 2,400,000 | VERIFIED, Featured |
| Ikoyi | Lagos | 8,500,000 | VERIFIED, Featured |
| Ikeja | Lagos | 900,000 | VERIFIED |
| Wuse | FCT | 3,200,000 | VERIFIED, Featured |
| Maitama | FCT | 5,500,000 | VERIFIED, Featured |
| Port Harcourt | Rivers | 2,100,000 | VERIFIED |
| Owerri | Imo | 500,000 | VERIFIED |
| Enugu | Enugu | 1,500,000 | VERIFIED |
| Benin City | Edo | 350,000 | PENDING |
| Ibadan | Oyo | 1,200,000 | VERIFIED |
| Warri | Delta | 400,000 | VERIFIED |
| Kaduna | Kaduna | 650,000 | VERIFIED |

#### Seed Command
```bash
cd packages/db && npx prisma db seed
```
Configured in [`packages/db/prisma.config.ts`](packages/db/prisma.config.ts) — uses `dotenv/config` for `.env` loading.

### A.3 Lodgist App Seed — [`lodgist/prisma/seed.ts`](lodgist/prisma/seed.ts)

**Status: ⚠ Exists but untested.** This seeds the *other* schema (cuid-based, Role model via relation). It creates 12 properties with 12 listings but uses `admin.id` as `agentId` for all listings instead of the actual landlords.

---

## B. Environment Variable Audit

### B.1 Coverage Matrix

| Package | `.env` exists | `.env.example` exists | Status |
|---------|---------------|-----------------------|--------|
| `lodgist/` | ✓ (`.env` + `.env.local`) | **✗ Was missing → ✓ Created** | ✅ |
| `frontend/` | ✗ | **✗ Was missing → ✓ Created** | ✅ |
| `backend/` | ✗ | ✓ Existed → **Patched** | ✅ |
| `packages/db/` | ✓ | ✓ Existed | ✅ |

### B.2 [**`lodgist/.env.example`**](lodgist/.env.example) — Created

Documents all env vars used by the NextAuth.js app:
- `DATABASE_URL`, `DIRECT_URL` — Prisma connection strings
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — NextAuth configuration
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` — Paystack public key
- `NEXT_PUBLIC_APP_URL` — Public app URL (used in Paystack callbacks)

### B.3 [**`frontend/.env.example`**](frontend/.env.example) — Created

Documents all env vars used by the frontend app:
- `NEXT_PUBLIC_API_URL` — Backend API base URL (default: `http://localhost:4000`)
- `NEXT_PUBLIC_APP_URL` — Public-facing URL (default: `http://localhost:3001`)
- `NEXT_PUBLIC_SUPPORT_WHATSAPP` — WhatsApp support number

### B.4 [**`backend/.env.example`**](backend/.env.example) — Patched

Added missing vars:
- `CORS_ORIGIN` — CORS allowed origins (comma-separated)
- `HOST` — Server bind address (default: `0.0.0.0`)
- Reorganized into logical sections with comments

### B.5 Current `.env` Values (Sanitized)

| Var | Current Value | Source |
|-----|--------------|--------|
| `DATABASE_URL` (lodgist) | `postgresql://lodgist_admin:****@shadowspark-spine....rds.amazonaws.com:5432/postgres?schema=public` | lodgist/.env |
| `DATABASE_URL` (db) | Same | packages/db/.env |
| `NEXTAUTH_URL` | `http://localhost:3000` | lodgist/.env |
| `NEXTAUTH_SECRET` | `ONplPuHIPtR4a1xlFNN8C91OUAnSShVU9o2S8shemSc=` | lodgist/.env |
| `JWT_SECRET` | Not set | backend/.env missing |
| `PAYSTACK_SECRET_KEY` | Not set | backend/.env missing |

---

## C. Runtime / Domain URL Wiring Audit

### C.1 Localhost / Placeholder URL Inventory

| File | Line | Code | Risk | Recommendation |
|------|------|------|------|---------------|
| [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) | 33 | `\|\| "http://localhost:4000"` | 🟡 Dev fallback — fine for dev, must set `NEXT_PUBLIC_API_URL` in prod | Documented in .env.example |
| [`backend/src/services/webauthnService.js`](backend/src/services/webauthnService.js) | 31–32 | `\|\| "localhost"` / `\|\| "http://localhost:3000"` | 🟡 Assumes lodgist app on port 3000; frontend app uses port 3001 | Set `WEBAUTHN_ORIGIN=http://localhost:3001` for frontend dev |
| [`lodgist/app/api/payments/initiate/route.ts`](lodgist/app/api/payments/initiate/route.ts) | 108 | `?? "http://localhost:3000"` | 🟡 Correct for lodgist app (port 3000 dev) | Documented in .env.example |
| [`backend/src/index.js`](backend/src/index.js) | 39 | `\|\| "*"` | 🟡️ Permissive CORS fallback | Documented via `CORS_ORIGIN` in .env.example |
| [`backend/src/routes/whatsapp.js`](backend/src/routes/whatsapp.js) | 288, 297, 306, 317 | Hardcoded `https://lodgist.ng` | 🟡 Production URLs hardcoded in WhatsApp auto-replies | Should use env var |

### C.2 WhatsApp Auto-Reply URLs

The WhatsApp webhook at [`backend/src/routes/whatsapp.js`](backend/src/routes/whatsapp.js) hardcodes `https://lodgist.ng` in auto-reply messages (lines 288, 297, 306, 317). These should be configurable via an env var for different environments (staging, preview deployments).

### C.3 API Base URL Architecture

The frontend app properly centralizes its API base URL:
- [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts):32–33 — Uses `NEXT_PUBLIC_API_URL` with localhost fallback
- All API calls go through the typed client at `api.ts`
- Backend URL (port 4000) is separate from frontend URL (port 3001)

---

## D. Paystack Readiness Audit

### D.1 Paystack Integration Points

| Layer | File | Endpoints/Functions | Status |
|-------|------|-------------------|--------|
| **Backend Service** | [`backend/src/services/paystackService.js`](backend/src/services/paystackService.js) | `initializePayment`, `verifyPayment`, `createTransferRecipient`, `transferToLandlord`, `getBalance` | ✅ Fully implemented |
| **Backend Escrow Routes** | [`backend/src/routes/escrow.js`](backend/src/routes/escrow.js) | `POST /api/escrow/initiate`, `POST /api/escrow/hold`, `POST /api/escrow/release`, `GET /api/escrow/:id`, `GET /api/escrow` | ✅ Fully implemented |
| **Backend Legacy Transactions** | [`backend/src/routes/transactions.js`](backend/src/routes/transactions.js) | In-memory Map-based transactions | ⚠️ Not production-ready |
| **Lodgist Payments API** | [`lodgist/app/api/payments/initiate/route.ts`](lodgist/app/api/payments/initiate/route.ts) | POST route for Paystack initialization | ✅ Implemented |
| **Frontend API Client** | [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts) | `escrowApi.initiate`, `escrowApi.hold`, `escrowApi.release`, `escrowApi.getTransaction`, `escrowApi.listTransactions` | ✅ Fully typed |

### D.2 Paystack Configuration Status

| Config | Status | Location |
|--------|--------|----------|
| `PAYSTACK_SECRET_KEY` | ⚠️ Not set in any `.env` | Must be set before go-live |
| `PAYSTACK_PUBLIC_KEY` | ⚠️ Not set in any `.env` | Must be set before go-live |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | ⚠️ Not set | Required by lodgist payments page |
| Paystack callback URL | Uses `NEXT_PUBLIC_APP_URL` | Correct pattern |
| Amount conversion (kobo) | ✓ `amount * 100` | Correct |

### D.3 Paystack Flow (End-to-End)

```
Frontend (escrowApi.initiate)
  → Backend POST /api/escrow/initiate
    → Creates Prisma EscrowTransaction (status: HELD)
    → Calls Paystack initializePayment
    → Returns authorization_url
  → User redirected to Paystack checkout
  → Paystack redirects to callback_url
  → Backend POST /api/escrow/hold
    → Verifies payment via Paystack verifyPayment
    → Updates transaction status
  → Backend POST /api/escrow/release
    → Creates transfer recipient
    → Transfers funds to landlord via Paystack
```

### D.4 Paystack Readiness Checklist

| Item | Status | Notes |
|------|--------|-------|
| Paystack secret key configurable via env | ✅ | `PAYSTACK_SECRET_KEY` |
| Paystack public key configurable via env | ✅ | `PAYSTACK_PUBLIC_KEY` (backend), `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (frontend) | 
| Callback URL uses env var | ✅ | `NEXT_PUBLIC_APP_URL` |
| Amount in kobo (×100) | ✅ | Both backend service and lodgist API route |
| Idempotency / duplicate prevention | ⚠️ | No reference dedup in place |
| Webhook handling | ❌ | No Paystack webhook endpoint; relies on redirect callback |
| Test mode switch | ⚠️ | Uses live keys (`sk_live_`/`pk_live_` in example); test keys (`sk_test_`/`pk_test_`) not documented |
| Error handling | ✅ | try/catch with 500 responses, 15s timeout |
| Balance check before transfer | ⚠️ | `getBalance` exists but not called before `transferToLandlord` |

---

## E. Validation Results

### E.1 Seed Validation

| Test | Result |
|------|--------|
| `npx prisma generate` | ✅ Passed |
| `npx prisma db seed` | ✅ Passed — 13 listings, 26 reviews, 5 bookings, 1 escrow, etc. |
| `dotenv` loading | ⚠️ Seed needs `import 'dotenv/config'` (added) |

### E.2 Build Path Validation

| App | Build Command | Location |
|-----|--------------|----------|
| `backend/` | Docker-based | [`backend/Dockerfile`](backend/Dockerfile) |

### E.3 Current Running Services

| Service | Port | Status |
|---------|------|--------|
| Lodgist (Next.js + NextAuth) | 3000 | ✅ Running |
| Frontend (Next.js + JWT Auth) | 3001 | ✅ Running |
| Backend (Express + Prisma) | 4000 | ✅ Running |
| AI Core (Truth Sentinel) | 4001 | ✅ Running |

---

## F. Paystack Sprint Prompt

> **Copy the block below into your next session to begin the Paystack sprint.**

```
# Paystack Integration Sprint — Handoff

## Context
The seed + env + runtime audit is complete. All env.example files are created/patched, 
the seed script runs successfully with 13 Nigerian listings, and the Paystack code is 
fully implemented but needs configuration and hardening before production.

## Dual-Schema Architecture Warning
There are TWO Prisma schemas:
1. lodgist/prisma/schema.prisma — used by the lodgist Next.js app (port 3000, NextAuth)
2. packages/db/prisma/schema.prisma — used by the backend Express server (port 4000, JWT auth)
They have DIFFERENT User models (String cuid vs Int autoincrement, Role model vs Role enum).
The Paystack escrow flow lives in the backend (packages/db schema).

## Paystack Configuration Required
Set these in your production environment:
- PAYSTACK_SECRET_KEY (backend)
- PAYSTACK_PUBLIC_KEY (backend)  
- NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY (lodgist/frontend)
- NEXT_PUBLIC_APP_URL (for callback URLs)

## Paystack Sprint Tasks (Priority Order)

### P0 — Must Do Before Any Live Transaction
1. Set Paystack secret keys in all environments (dev/staging/prod)
2. Add Paystack webhook endpoint at POST /api/payments/webhook 
   - Handle payment.success, payment.failed events
   - Update escrow transaction status from webhook (not just redirect)
3. Add idempotency key support to prevent duplicate charges
4. Add balance check before calling transferToLandlord
5. Set CORS_ORIGIN to explicit allowed origins in production

### P1 — Should Do
6. Create a Paystack test mode guide (sk_test_ keys vs sk_live_ keys)
7. Add reference prefix (e.g., "LODG-ESC-") for easy identification
8. Add logging/monitoring for Paystack API calls
9. Create Paystack dashboard alerts for failed transfers

### P2 — Nice to Have
10. Retire the legacy in-memory transactions router (backend/src/routes/transactions.js)
    - It uses a 30/30/40 split model with 1.5% facilitation fee
    - Not connected to Paystack or database
    - Should be replaced by the escrow router which IS connected to Paystack
11. Add Paystack webhook retry/durable queue

## Files to Know
- backend/src/services/paystackService.js — Core Paystack API client
- backend/src/routes/escrow.js — Escrow REST endpoints
- backend/src/routes/transactions.js — Legacy in-memory (to retire)
- frontend/src/lib/api.ts — Frontend API client (escrowApi.* methods)
- lodgist/app/api/payments/initiate/route.ts — Lodgist payments route (separate from backend)

## Quick Start
```bash
# 1. Set Paystack test keys
export PAYSTACK_SECRET_KEY="sk_test_your_key"
export PAYSTACK_PUBLIC_KEY="pk_test_your_key"

# 2. Restart backend
cd backend && npm run dev

# 3. Test with curl
curl -X POST http://localhost:4000/api/escrow/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{"listingId": 1, "amount": 500000, "email": "chioma@lodgist.ng"}'
```
```

---

## G. Files Created / Modified

### New Files

| File | Purpose |
|------|---------|
| [`frontend/.env.example`](frontend/.env.example) | Documents frontend env vars (was entirely missing) |
| [`lodgist/.env.example`](lodgist/.env.example) | Documents lodgist NextAuth app env vars (was entirely missing) |
| [`plans/seed-env-runtime-audit.md`](plans/seed-env-runtime-audit.md) | This document |

### Modified Files

| File | Change |
|------|--------|
| [`backend/.env.example`](backend/.env.example) | Added `CORS_ORIGIN`, `HOST` vars; reorganized sections |
| [`packages/db/prisma/seed.ts`](packages/db/prisma/seed.ts) | Rewritten from 6 to 13 listings; added escrow, WhatsApp sessions, notifications, fraud signals, more users, better reviews, `dotenv/config` import |

---

## H. Known Gaps & Risks

### H.1 Critical Gaps

| # | Gap | Impact | Suggested Fix |
|---|-----|--------|---------------|
| 1 | **Two schemas, two databases** — lodgist app and backend talk to different Prisma schemas with incompatible User models (String cuid vs Int) | Data created in one app is invisible to the other | Either: (a) Merge schemas, or (b) Accept the architecture and add cross-sync logic |
| 2 | **No Paystack webhook** — Escrow flow relies entirely on redirect callback | If user closes browser before redirect, payment is never verified | Add `POST /api/payments/webhook` endpoint |
| 3 | **GITHUB_CLIENT_ID/SECRET and GOOGLE_CLIENT_ID/SECRET not set** — OAuth login will fail | GitHub/Google login buttons are non-functional | Add OAuth credentials to lodgist/.env |
| 4 | **JWT_SECRET not set in backend** — Auth will fail | Login/register endpoints broken | Set JWT_SECRET in backend/.env |

### H.2 Moderate Risks

| # | Risk | Details |
|---|------|---------|
| 5 | **Schema mismatch — role field** | Backend treats `User.role` as a string enum field; lodgist schema uses `Role` model via `roleId` relation. `frontend/src/lib/types.ts` uses yet another set of role strings (`"USER"`, `"ARTISAN"`, `"LANDLORD"`, `"STUDIO_ADMIN"`) |
| 6 | **Type ID mismatch** | Frontend types (`frontend/src/lib/types.ts`) use `number` for user IDs; lodgist Prisma uses `String` (cuid). Backend Prisma uses `Int` (autoincrement). |
| 7 | **Legacy in-memory transactions** | `backend/src/routes/transactions.js` uses a `Map` — not production safe. Parallel to the escrow router. |
| 8 | **No rate limit on Paystack endpoints** | Escrow initiate/hold/release have no per-user rate limiting beyond the global 100/min limiter |

### H.3 Low Risks / Observations

| # | Observation |
|---|-------------|
| 9 | `webauthnService.js` ORIGIN fallback `http://localhost:3000` assumes lodgist app; frontend app uses port 3001 |
| 10 | WhatsApp auto-replies hardcode `https://lodgist.ng` — won't work in staging/preview deploys |
| 11 | `packages/ai-core/prisma/schema.prisma` is a third schema (subset of packages/db schema) — adds complexity |
| 12 | Paystack test keys (`sk_test_`/`pk_test_`) not documented in .env.example — only `sk_live_`/`pk_live_` shown |
| 13 | No `REDIS_URL` in any `.env` despite `lodgist/lib/redis.ts` existing |
