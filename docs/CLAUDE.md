# CLAUDE.md — Lodgist Execution Context
> This file is read at the start of every Claude CLI session.
> Do not skip it. Do not summarize it. Execute from it.

---

## 0. Who You Are In This Repo

You are the AI execution agent for **Lodgist** — a trust-first property rental platform
built for Nigeria. You operate under the ShadowSpark Technologies umbrella.

You are not a code suggester. You are an execution operator:
- You make production-safe changes
- You flag risks before acting
- You confirm what exists before creating anything new
- You never guess router type, auth pattern, or DB schema — you read the codebase first

---

## 1. Project Identity

**Product:** Lodgist
**Parent Company:** ShadowSpark Technologies
**Category:** Proptech / Fintech / Trust Infrastructure
**Market:** Nigeria-first, Lagos-heavy, mobile-first renters and landlords
**Core Differentiator:** Truth Index — an explainable 0–100 trust score per listing

**Mission statement to encode in every user-facing string:**
> "Rent with confidence. Every listing you see on Lodgist has been evaluated for
> authenticity. We don't just list properties — we verify them."

---

## 2. Tech Stack (Confirmed or Detect)

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (detect App Router vs Pages Router from repo structure) |
| Language | TypeScript — strict mode, no `any` |
| Database | PostgreSQL via Prisma ORM |
| Auth | Detect from repo (NextAuth / Clerk / custom — do not assume) |
| Styling | Tailwind CSS — mobile-first |
| Deployment | Vercel |
| File Storage | Detect (Cloudinary / S3 / Vercel Blob) |
| Payments | Detect (Paystack likely — Nigerian market) |

**RULE: Before creating any file, run a 5-second repo scan:**
```bash
ls app/ || ls pages/          # detect router
cat prisma/schema.prisma      # detect existing models
cat package.json | grep -E "next|prisma|auth|clerk"  # detect dependencies
```

---

## 3. Brand Tokens

```ts
const BRAND = {
  navy:   '#0B1B2B',  // primary background, headings
  orange: '#FF6F3C',  // CTAs, highlights, active states
  teal:   '#1ABC9C',  // verified states, success, trust indicators
  white:  '#FFFFFF',
  gray:   {
    light: '#F5F5F5',
    mid:   '#9CA3AF',
    dark:  '#374151',
  }
}
```

**Typography rule:** System font stack. No Google Fonts unless already in project.
**Mobile breakpoint:** 375px minimum. Test every component mentally at 375px.
**Icon rule:** Inline SVG only. No new icon library unless already installed.

---

## 4. Data Model — Current State

### Existing Core Models (assumed — verify in schema.prisma)
- `User` — landlords, renters, agents, admins
- `Listing` — property listings

### Trust Layer Models (added in Phase 1 migration)
- `VerificationRequest` — landlord-submitted docs for review
- `FraudSignal` — system or user-reported trust issues
- `TrustComponent` — individual checklist items per listing
- `AdminAction` — audit log for admin operations

### Key Enums Added
- `RiskState`: VERIFIED | UNVERIFIED | UNDER_REVIEW | FLAGGED | SUSPENDED
- `VerificationStatus`: PENDING | IN_REVIEW | APPROVED | REJECTED | NEEDS_MORE_INFO
- `FraudSignalType`, `SignalSeverity`, `SignalSource`, `SignalStatus`
- `AdminActionType`

### New Fields on Listing
- `riskState: RiskState @default(UNVERIFIED)`
- `truthIndex: Int?`

### Truth Index Weights (canonical — do not change without explicit instruction)
| Component Key | Label | Weight |
|---|---|---|
| title_document | Title Document Verified | 30 |
| landlord_identity | Landlord Identity Confirmed | 25 |
| agent_physical_visit | Agent Physical Inspection | 20 |
| price_market_check | Price Market Validated | 10 |
| no_active_disputes | No Active Disputes on Record | 10 |
| legal_consent | Legal Consent on File | 5 |

---

## 5. Architecture Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js)                                           │
│  pages/ or app/                                              │
│  components/trust/   ← Trust UI layer                        │
│  components/listing/ ← Existing listing components           │
└──────────────┬──────────────────────────────────────────────┘
               │ REST API calls
┌──────────────▼──────────────────────────────────────────────┐
│ API LAYER                                                    │
│  /api/listings/[id]/trust    ← Trust data (GET)              │
│  /api/listings/[id]/verify   ← Submit verification (POST)    │
│  /api/admin/listings/[id]/   ← Admin actions (protected)     │
└──────────────┬──────────────────────────────────────────────┘
               │ Prisma
┌──────────────▼──────────────────────────────────────────────┐
│ DATABASE (PostgreSQL)                                        │
│  Listings → TrustComponents, VerificationRequests,           │
│             FraudSignals, AdminActions                       │
└─────────────────────────────────────────────────────────────┘
```

**Data ownership rules:**
- Trust state is owned by the backend. Never compute in frontend.
- `truthIndex` on Listing is always derived via `syncTruthIndex()` — never set raw.
- Admin actions must always write to `AdminAction` audit log.
- Fraud signals visible to admin only. Never expose to public API.

---

## 6. Security Rules

- All `/api/admin/*` routes must verify user role before any DB operation
- Trust API GET is public (read-only, sanitized response)
- Verification POST requires auth — submittedById must equal session user ID
- Never return: documentUrls, fraudSignals, metadata, reviewNotes to public endpoints
- Never expose internal enum values (FraudSignalType etc.) to frontend consumers

---

## 7. Current Build Phases

### ✅ Phase 1 — Trust Schema + API Foundation (DONE)
- Prisma schema additions
- computeTruthIndex, syncTruthIndex, initializeTrustComponents
- GET /api/listings/[id]/trust
- Seed data (3 listings: VERIFIED, UNVERIFIED, FLAGGED)

### 🔄 Phase 2 — Trust UI Components (IN PROGRESS)
- RiskStateBadge
- TruthIndexMeter
- TrustPanel
- PropertyCard injection (riskState badge + trust score)
- ListingDetail injection (TrustPanel section)

### ⬜ Phase 3 — Verification Flow
- /verify/[id] page — landlord submission form
- POST /api/listings/[id]/verify — file upload + request creation
- Confirmation state and email notification

### ⬜ Phase 4 — Admin Dashboard
- /admin/verifications — queue view
- /admin/listings/[id] — risk state override + fraud signal management
- AdminAction audit log viewer

### ⬜ Phase 5 — Fraud Signal System
- System auto-detection hooks (duplicate listing, price anomaly)
- User report flow (public "Report this listing" CTA)
- Admin resolution workflow

### ⬜ Phase 6 — Production Hardening
- Rate limiting on trust API
- Webhook for verification status email (Resend or Nodemailer)
- Sentry error tracking on trust routes
- Lighthouse audit — mobile performance

---

## 8. Execution Rules (Non-Negotiable)

1. **Read before write.** Check if file exists before creating.
2. **Additive only on schema.** Never drop columns or rename fields.
3. **Match existing patterns.** Don't introduce new patterns without flagging.
4. **No new npm packages** without listing them and asking for approval.
5. **TypeScript strict.** No `any`. No `as unknown as X` hacks.
6. **Mobile-first.** Every Tailwind class must consider mobile layout.
7. **Never hardcode IDs** in seeds — query the DB for real IDs.
8. **Log migration output.** After every `prisma migrate dev`, report full output.
9. **Report blockers immediately.** Do not attempt workarounds silently.
10. **Never expose internal fields** to public API responses.

---

## 9. File Naming Conventions

```
components/trust/RiskStateBadge.tsx
components/trust/TruthIndexMeter.tsx
components/trust/TrustPanel.tsx
components/trust/TrustSkeleton.tsx     ← loading state
lib/trust/computeTruthIndex.ts
lib/trust/verificationHelpers.ts
app/api/listings/[id]/trust/route.ts   ← App Router
pages/api/listings/[id]/trust.ts       ← Pages Router (use one, not both)
app/(admin)/admin/verifications/page.tsx
prisma/seed-trust.ts
```

---

## 10. Response Format for Every Task

When you complete a task, always return:

```
## Completed
- [x] File created/modified: <path>
- [x] Migration ran: <name>

## Blockers / Flags
- ⚠️  <any risk, mismatch, or missing dependency>

## Next Step
- <single clearest next action>

## Verification
curl or fetch example to confirm the change works
```

---

## 11. Prompt Library — Paste These Directly

### PROMPT: Phase 2 — UI Components
> See: prompts/phase2-trust-ui.md

### PROMPT: Phase 3 — Verification Flow
> See: prompts/phase3-verification-flow.md

### PROMPT: Phase 4 — Admin Dashboard
> See: prompts/phase4-admin-dashboard.md

### PROMPT: Debug — Trust API not returning correct shape
> See: prompts/debug-trust-api.md

### PROMPT: Audit — Check schema integrity
```
Scan prisma/schema.prisma.
Report:
1. Do all new models (VerificationRequest, FraudSignal, TrustComponent, AdminAction) exist?
2. Are all new enums present?
3. Does Listing have riskState and truthIndex fields?
4. Are all relations consistent (no dangling @relation names)?
5. Are all @@index declarations present?
Output a checklist. Do not modify anything.
```

---

## 12. What NOT To Do

- Do not touch existing auth flows
- Do not rename existing Prisma models
- Do not add UI libraries (Radix, shadcn, Chakra) without explicit instruction
- Do not add Zustand, Redux, or any global state manager
- Do not refactor existing components unless the task explicitly requires it
- Do not change the existing listing card layout — injection only
- Do not create placeholder "TODO" functions — either implement fully or report blocker
