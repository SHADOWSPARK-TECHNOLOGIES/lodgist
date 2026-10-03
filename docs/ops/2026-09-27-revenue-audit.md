# Objective 2 — Revenue Surface Audit (corrected)

**Date:** 2026-09-27  
**Role:** Read-only inventory of payment/commission/verification artifacts  
**Correction note:** Initial grep under-reported hits. Manual file inspection of backend/src/services/ and backend/src/routes/ revealed a fully wired Paystack escrow system. This report supersedes the earlier version.

## Payment provider inventory

**Paystack: WIRED — fully integrated**

Files:
- `backend/src/services/paystackService.js` (371 lines) — Paystack API client: initializePayment, verifyPayment, createTransferRecipient, transferToLandlord, getBalance. Uses PAYSTACK_SECRET_KEY env var. Idempotency store (in-memory Map, 24h TTL). Reference prefix `LODG-ESC-`. Amounts in kobo.
- `backend/src/routes/payments.js` (422 lines) — Paystack webhook receiver: POST /api/payments/webhook. HMAC-SHA256 signature verification. DB-backed idempotency via ProcessedWebhookEvent. Handles charge.success, charge.failed, transfer.success, transfer.failed. Routes to booking or escrow handlers based on reference prefix `LODG-ESC-BK-` vs `LODG-ESC-`.
- `backend/src/routes/bookings.js` (423 lines) — Booking payment flow: POST /initiate-payment calls PaystackService.initializePayment. POST /checkout/webhook handled by payments.js. PATCH /manual-payment for bank transfer fallback. PATCH /verify-payment for admin approval.
- `backend/src/routes/escrow.js` (367 lines) — Escrow transaction flow: POST /hold-escrow (Paystack payment → HELD), POST /release (Paystack transfer to landlord), GET /:id, GET /. Balance check before release. Transferrecipient creation. Uses prisma.escrowTransaction.
- `backend/src/routes/transactions.js` (257 lines) — In-memory escrow/milestone skeleton (NOT wired to Paystack — uses Map, not DB; has 30/30/40 split and 1.5% facilitation fee constants but no Paystack calls).

**Flutterwave: NOT wired**  
**Stripe: NOT wired**

## Commission / split logic

**Commission logic: WIRED — two implementations found**

### 1. Escrow 30/30/40 split (transactions.js — in-memory skeleton)
File: `backend/src/routes/transactions.js`
- SPLIT constant: `{ tenant: 0.3, landlord: 0.3, platform: 0.4 }` (30/30/40)
- FACILITATION_FEE_RATE = 0.015 (1.5%)
- Calculates: facilitationFee, netAmount, tenantShare, landlordShare, platformShare
- Status flow: HELD → RELEASED | REFUNDED
- WARNING: This is an in-memory Map, not DB-backed. Not wired to Paystack. This is a skeleton or early draft.

### 2. Paystack escrow release (escrow.js — live, DB-backed)
File: `backend/src/routes/escrow.js`
- No explicit commission split in the release flow — full `escrowTransaction.amount` is transferred to landlord via Paystack transferToLandlord
- No platform fee deduction visible in the release path
- The commission model (if any) is not applied at release time in the live escrow route

### Commission gap
The in-memory transactions.js defines a 30/30/40 split with 1.5% facilitation fee, but the live escrow.js release flow transfers the full amount to the landlord with no platform cut. The commission model exists on paper (in the skeleton) but is NOT applied in the live Paystack-backed escrow flow.

## Escrow flow (live, Paystack-backed)

Status states: PENDING → HELD → RELEASED | DISPUTED | FAILED

Flow:
1. Tenant initiates Paystack payment via POST /api/escrow/hold-escrow (or booking POST /initiate-payment)
2. Paystack charge.success webhook → escrowTransaction status → HELD
3. Landlord confirms move-in → POST /api/escrow/release
4. Release: balance check → createTransferRecipient → transferToLandlord → status → RELEASED
5. transfer.success webhook → RELEASED (redundant confirmation)
6. transfer.failed webhook → DISPUTED

## Transaction models (DB-backed, Prisma)

Prisma models referenced in routes:
- `escrowTransaction` — used by escrow.js and payments.js webhook handlers. Fields include: id, tenantId, landlordId, listingId, amount, currency, status, paystackReference, paystackAuthorizationUrl, releaseDate, createdAt, updatedAt
- `booking` — used by bookings.js. Fields include: id, listingId, tenantId, startDate, endDate, totalAmount, currency, status, paystackReference, manualPaymentRef, verifiedBy, verifiedAt, adminNotes
- `processedWebhookEvent` — used by payments.js for idempotency. Field: id (unique constraint P2002)

The transaction.js in-memory Map is NOT the production model — the live system uses Prisma models.

## Verification / trust surface

**Trust Protocol: WIRED**

Files:
- `backend/src/services/trustProtocolService.js` (354 lines) — Consolidated risk scoring engine. Weights: ai_analysis 35%, land_registry 30%, geospatial 20%, owner_verification 15%. Returns overall_score (0-100), risk_level (low/medium/high/critical), component scores, recommendations.
- `backend/src/services/trustService.js` — exists (file present in services/)
- `backend/src/services/landRegistryValidator.js` — geospatial/flood zone validation
- `backend/src/services/geminiService.js` — AI scam analysis

**Verification routes:**
- `backend/src/routes/verification.js` — exists (file present)

**Trust Index:**
- `backend/src/routes/truthIndex.js` — exists (file present, referenced in index.js route listing)
- `backend/src/services/trustSafetyEngine.js` — exists

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Payment provider wired | YES — Paystack | Full integration: initialize, verify, transfer, webhook, HMAC, idempotency |
| Commission logic | PARTIAL — exists in skeleton, NOT applied in live flow | 30/30/40 split + 1.5% fee in transactions.js (in-memory, unused). Live escrow.js releases full amount to landlord with no platform cut. |
| Transaction models | YES — Prisma-backed | escrowTransaction, booking, processedWebhookEvent. transactions.js in-memory Map is a dead skeleton. |
| Escrow logic | YES — live, Paystack-backed | Full escrow flow: hold → release → transfer. Balance check, transferrecipient, webhook-driven state machine. |
| Verification surface | YES | trustProtocolService.js, verification routes, truthIndex routes, land registry validation |
| Trust/Truth Index | YES | trustProtocolService.js, trustService.js, trustSafetyEngine.js, truthIndex route |
| Checkout skeleton | YES — AND wired | bookings.js checkout endpoints are wired to Paystack via paystackService.js |
| Receipt generation | YES | Receipt shape in booking responses and escrow release responses |

## Key finding for Objective 3

Paystack IS wired. The escrow flow is live and DB-backed. However, the commission model (30/30/40 split + 1.5% facilitation fee) exists only in the in-memory transactions.js skeleton and is NOT applied in the live escrow release flow. This means Objective 3B applies: draft the commission model — specifically, how to bridge the gap between the defined 30/30/40 split and the current full-transfer-to-landlord release path.
