# A+ Readiness Assessment — Lodgist

**Date:** 2026-09-27 (WAT UTC+01:00)
**Mode:** Read-only. No code changed, no deploy, no secrets read.
**Method:** Direct file inspection of backend/src/, packages/db/prisma/, lodgist/app/, .github/workflows/, plus the two prior audit reports (secret-hygiene.md, admin-ui-gap.md).
**Why this exists:** The overnight autonomous run's original A+ audit (9 subagent dimensions) was interrupted by model rate limits (HTTP 429). This report completes the assessment from direct evidence instead of delegating.

---

## Executive summary

Lodgist is a **B+/A- codebase, not A+**. The core revenue path (Paystack → escrow → release) is real, guarded, and webhook-idempotent — that is the hard part and it is done correctly. The gaps are concentrated in four places, none of which block a private beta but all of which block an honest A+:

1. **Commission is unwired.** Escrow release transfers the FULL amount to the landlord (`escrow.js:266`). The only commission definition (`transactions.js`, 30/30/40 + 1.5%) is an in-memory Map, never called by the live flow. This is Decision 1 from the morning brief and it is still open.
2. **Live Paystack keys are absent from Railway.** The `lodgist-api` Railway service has zero `PAYSTACK_*` env vars (confirmed in secret-hygiene.md). The webhook HMAC and every transfer would fail in production until keys are set. This is a deployment blocker, not a code bug.
3. **Liveness gate is a flag, not a check.** `livenessGate.js:113-123` `verifyHNWLiveness` returns mock `verified: true`. The `requireLiveness` middleware checks `req.user.isHNW` (a boolean) and never calls a real biometric SDK. HNW transactions (≥ ₦10M) are gated only by a database flag that nothing sets securely.
4. **Two frontends exist** (`lodgist/` Next.js app router AND `frontend/src` older React), and the admin dashboard is stats-only with no payment-verification UI. This is the admin-ui-gap finding.

Grade by dimension below.

---

## Dimension 1 — Backend / API: **A-**

Strong. Evidence from `backend/src/index.js`:

- Helmet, CORS fail-closed (empty origin list in prod if `CORS_ORIGIN` unset — `index.js:66-71`), global rate limit 100/min, auth rate limit 20/min, morgan logging.
- Production startup guards: crashes at boot if `JWT_SECRET`, `CORS_ORIGIN`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` missing or localhost (`index.js:38-49`). Correct fail-closed posture.
- Webhook raw-body capture is correctly ordered — `express.raw` for `/api/payments/webhook` and `/api/whatsapp/webhook` precedes `express.json` (`index.js:95-99`).
- 404 handler + global error handler present.
- Health endpoint reports DB status and latency.

Gaps keeping it from A+:
- **No input-validation library** (no zod/joi/express-validator in backend). All validation is hand-rolled field checks (`escrow.js:27-39`). Consistent but easy to miss a field.
- **`requireAuth` trust boundary is thin**: JWT verify only — no token revocation, no refresh invalidation on password change (beyond expiry).
- **Error responses leak `error.message`** to clients (`escrow.js:89`, `escrow.js:163`, `escrow.js:291`) — could expose internal detail (e.g. Paystack message) to a tenant.

---

## Dimension 2 — Database / Schema: **A-**

Strong. `packages/db/prisma/schema.prisma`:

- 15 enums, comprehensive models (User, Listing, Property, Booking, EscrowTransaction, Review, FraudReport, AIFraudSignal, TruthIndexScore, WhatsApp*, NextAuth Account/Session/VerificationToken, ProcessedWebhookEvent, PasskeyCredential, etc.).
- Indexes on every foreign-key/hot-query path (`status`, `tenantId`, `landlordId`, `listingId`, `userId`, `reference`).
- Webhook idempotency is DB-backed via `ProcessedWebhookEvent` unique PK — survives restarts and horizontal scaling (`payments.js:115-125`).
- Migrations are additive (baseline + incremental, no drops/renames visible in history).

Gaps:
- **Commission fields do not exist** on `EscrowTransaction`. There is no `facilitationFee`, `platformShare`, or `commissionRate` column. Any commission patch (Decision 1) requires a schema change + migration before it can be wired.
- **`EscrowTransaction.paystackReference` is NOT `@unique`** (only `reference` is — `schema.prisma:287-300`). A duplicate Paystack reference could attach to two escrow rows. `Booking.paystackReference` IS unique (`:234`); escrow should match.
- `Float` for `amount`/`price` (not `Decimal`) — floating-point money is a rounding risk at scale. Prisma `Decimal` is the correct type for Naira amounts.

---

## Dimension 3 — Payments / Revenue: **B+ (blocked on two things)**

The flow is real and correct where it exists:

- `paystackService.js` — initialize, verify, transfer, transferrecipient, balance; kobo conversion; idempotency-key support; `LODG-ESC-` reference prefix.
- `payments.js` webhook — HMAC-SHA256 verified with `timingSafeEqual` (`:38-51`), event-idempotent via DB, routes charge/transfer success/failure to Booking or Escrow state transitions. Returns 200 early to prevent Paystack retry storms. This is genuinely good.
- `escrow.js` — initiate (PENDING) → hold (HELD) → release (RELEASED), with landlord-authorization check (`:194`) and a **balance check before transfer** (`:210-243`). Fail-closed on insufficient balance.

Gaps:
- **Commission not applied at release** (Decision 1). `escrow.js:266` sends `escrowTransaction.amount` (full) to the landlord.
- **Live Paystack keys absent from Railway** — every Paystack call would fail in production. This must be fixed before the first real charge, independent of commission.
- **`idempotencyStore` in paystackService is in-memory Map** (`paystackService.js:63`) — the comment itself says "should be backed by Redis or the database." The webhook path IS DB-backed (good), but the initiate-payment path is not; a process restart during a double-click window could double-charge.
- `handleChargeSuccess` for booking auto-confirms with `verifiedBy: null` (system-automated) — reasonable, but should be recorded as a distinct verifier type for audit, not conflated with "no verifier."

---

## Dimension 4 — Trust / Verification: **B+**

- Trust components, TruthIndex (0-100), RiskState, VerificationRequest, FraudSignal, AdminAction all present in schema and routes (`truthIndex.js`, `verification.js`, `trustProtocolService.js`, `trustSafetyEngine.js`, `listingScamDetection.js`, `landRegistryValidator.js`).
- Truth Index is backend-derived (per CLAUDE.md rule), not frontend-computed. Good ownership.

Gaps:
- **Liveness verification is a stub** (`livenessGate.js:113-123` returns mock `verified: true`). The HNW gate (`requireLiveness`) only checks `req.user.isHNW` — a boolean — so "biometric verification" is currently a database flag with no enforcement. For A+, this needs a real SDK (SmileIdentity/Onfido/FaceTec) or the HNW tier must be explicitly descoped from launch.
- Verification document storage/audit path exists in schema but the "who pays for verification" model is unanswered (the original Obj 3C, skipped because trust surface exists — but the *monetization* of verification was never resolved).

---

## Dimension 5 — Frontend / UI: **B**

- `lodgist/` is a Next.js App Router app: (auth)/login/register/forgot-password, dashboard/admin|agent|landlord, listings/[id], search, verify, plus API routes for admin/auth/bookings/fraud-reports/listings/payments/properties/verify/whatsapp.
- Error boundary (`error.tsx`) and loading skeleton (`ListingDetailLoading`) exist. Base UI components (button, card) via base-ui + cva. zod + react-hook-form on auth forms.

Gaps:
- **Two frontends**: `lodgist/` (Next.js, active) and `frontend/src` (older React, present). The older one is drift/confusion risk and should be archived or explicitly marked legacy.
- **Admin dashboard is stats-only** — no bookings queue, no `PENDING_VERIFICATION` filter, no approve/reject control for `PATCH /api/bookings/:id/verify-payment` (full finding in admin-ui-gap.md). Backend is ready; the UI is the only thing between "ready" and "admin can collect revenue without curl."
- One placeholder dashboard page still says "Welcome to your Dashboard!" (`frontend` dir) — cosmetic but signals the legacy app is not yet retired.

---

## Dimension 6 — Security / Secrets: **B+**

From secret-hygiene.md (confirmed this session):

- No live secret committed to git. F4 held. Only `.env.example`/`.env.template` templates with redacted placeholders.
- Webhook HMAC + timingSafeEqual correct. Auth routes rate-limited. Role guards on sensitive routes.

Gaps:
- **`github.authkey` still live in git history**, PR #6 open and unmerged. Requires founder action in GitHub UI (rotate + merge the untrack commit `1f500675`).
- Track B rotation not started.
- `APPRUNNER_DEPLOY.md:57` has a `sk_live_...` placeholder — confirm it is never the real key (founder confirmation, AWS-side).

---

## Dimension 7 — Infrastructure / Deployment: **C**

This is the weakest dimension. **Four** deploy targets coexist:

- AWS App Runner + ECR (`apprunner.yaml`, `.github/workflows/deploy-backend.yml`)
- Render (`render.yaml`)
- Railway (`railway-inventory.md`, live services `lodgist` and `lodgist-api`)
- Vercel (`vercel.json`) + a deprecated Amplify path (`amplify.yml`, BETA_STATUS notes 14 consecutive build failures)

This is textbook drift. Different providers, different env-var sets, no single source of truth for "where does production actually run." BETA_STATUS.md points at App Runner (`3trpjpyhu2.us-east-1.awsapprunner.com`) while the overnight run verified Railway (`lodgist-api-production.up.railway.app`). **Two "production" backends is a real finding**, and it is why the Paystack keys are missing on Railway — the team may be treating Railway as canonical for API but deploying elsewhere.

For A+: pick ONE canonical host for the API (recommendation: Railway, since it's live and verified healthy with the correct health endpoint), retire or clearly demote the others, and put the env-var set in a single template.

---

## Dimension 8 — Governance / Documentation: **B+**

- CLAUDE.md (execution context), AGENTS.md (10 specialist roles + orchestration rules), BETA_STATUS.md (readiness snapshot + verified endpoints), NEW_TASK.md, ORCHESTRATOR_START.md, railway-inventory.md all present and detailed.
- BETA_STATUS.md is the strongest doc — it lists every endpoint with a verified? flag and notes.

Gaps:
- CONTEXT-TRANSFER.md is under repair (the truth-pointer dependency that triggered the overnight v2 prompt). Until it's fixed, the "source of truth" for cross-session context is ambiguous.
- No CHANGELOG, no ADR (architecture decision record) for the commission model or the multi-host situation. The commission decision (5% vs 30/30/40) should be captured as an ADR once decided.

---

## Dimension 9 — Track B / Domain / External: **B-**

From TRACK_B.md and secret-hygiene.md:

- Domain canonicalization unresolved (lodgist.online vs shadowspark-tech.org vs lodgist.shadowspark-tech.site).
- `github.authkey` rotation pending (Tier 2/3, founder action).
- Track B rotation (T3.2) not started — multi-session founder action.
- F13 held: no Track B (Vercel/morontomornica7) actions taken.

---

## Consolidated grade table

| # | Dimension | Grade | Top blocker |
|---|-----------|-------|-------------|
| 1 | Backend / API | A- | No input-validation library; error.message leaked to clients |
| 2 | Database / Schema | A- | No commission fields; Float money; escrow ref not unique |
| 3 | Payments / Revenue | B+ | Commission unwired; live keys absent on Railway |
| 4 | Trust / Verification | B+ | Liveness is a stub flag, not a check |
| 5 | Frontend / UI | B | Two frontends; admin dashboard stats-only |
| 6 | Security / Secrets | B+ | github.authkey live in history (PR #6) |
| 7 | Infrastructure / Deploy | C | Four deploy targets; no canonical host |
| 8 | Governance / Docs | B+ | No ADR/CHANGELOG; CONTEXT-TRANSFER under repair |
| 9 | Track B / Domain | B- | Domain not canonicalized; rotations pending |

**Overall: B+.** Not A+. The revenue core is real and safe; the gap between B+ and A+ is (1) pick one host, (2) wire the commission, (3) put the live Paystack keys on the canonical host, (4) replace the liveness stub or descope HNW, (5) retire the legacy frontend and build the admin verify-payment UI.

---

## What is actionable WITHOUT the founder (Tier 1, reversible)

These can be done immediately, no money movement, no deploy:

1. Add `@unique` to `EscrowTransaction.paystackReference` in schema.prisma (schema file only — migration deferred).
2. Switch `amount`/`price`/`totalAmount` to `Decimal` in schema.prisma (file only).
3. Archive/flag `frontend/` as legacy in a README note.
4. Write the ADR skeleton for the commission decision so the founder just fills in the number.

## What REQUIRES the founder (Tier 2/3 or decision)

1. **Decision 1 — commission rate**: 5% facilitation fee (my recommendation) vs the 30/30/40 split in transactions.js. This is a business decision, not a code one.
2. **Decision 2 — apply the commission patch now or after staging.**
3. **Decision 3 — RC-RAILWAY-002/003 contract files** are still missing from the worktree.
4. **Set live PAYSTACK_* env vars on the canonical Railway service** (founder holds the keys).
5. **Pick one canonical host** (Railway recommended) and retire/demote the others.
6. **Rotate github.authkey** and merge PR #6 (founder, GitHub UI).
7. **Replace or descope the HNW liveness stub.**

---

NOW — Lodgist is a B+, the revenue core is safe and webhook-idempotent, but it is not A+ and will not reach A+ until the four structural gaps (single host, wired commission, live keys on the canonical host, real-or-descoped liveness) are closed · next: founder decides commission rate and canonical host; I can then wire commission, fix the schema gaps, and build the admin verify-payment UI.
