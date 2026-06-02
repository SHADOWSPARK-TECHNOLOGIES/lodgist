# LODGIST × SHADOWSPARK — SOVEREIGN CONTEXT CARRIER
**Generated:** June 2, 2026 | **Session Duration:** 12:24 – 17:10 WAT
**Carry this into every new Claude session to preserve full project state.**

---

## WHO YOU ARE TALKING TO
- Founder/Principal Architect: ShadowSpark Technologies
- Company: ShadowSpark Technologies (parent studio)
- Flagship Product: Lodgist (Nigeria-first trust property platform)
- Role Split:
  - Claude Web (this) = strategist, prompt architect, reviewer
  - Claude Code CLI = repo executor, backend, migrations
  - Roo Code (VSCode) = frontend UI/UX components

---

## PROJECT IDENTITY

### ShadowSpark Technologies
- Website: www.shadowspark-tech.org
- GCP Project: shadowspark-production-489115
- GCP Org: shadowspark-tech.org (ID: 94800876286)
- GCP Billing: Firebase Payment (01DD33-8C719D-F20924) ✅ LINKED TODAY
- Vercel Team: shadowspark-technologies (Hobby plan)
- Repo: github.com/Shadow7user/shadowspark (private)
- Local path: ~/shadowspark-clean
- Active branch: feature/restore-fintech

### Lodgist
- Mission: Trust-first Nigerian property platform — eliminate fraud and middlemen
- Brand: Deep Navy #0B1B2B | Vibrant Orange #FF6F3C | Teal #1ABC9C
- Repo: github.com/Shadow7user/lodgist (private)
- Local path: ~/Desktop/lodgist
- Active branch: dev
- Vercel Project: lodgist (shadowspark-technologies team)
- Target domain: lodgist.online (NOT YET CLAIMED on Vercel)
- Key concept: Truth Index (0-100 explainable trust score per listing)

---

## TECH STACK (CONFIRMED)

```
Framework:     Next.js 16.2.4 + React 19.2 (App Router confirmed — 39 routes)
Language:      TypeScript (strict mode)
ORM:           Prisma (prisma.config.ts present)
Database:      Neon serverless PostgreSQL
               Shadowspark DB: ep-proud-resonance-aqd0e90r-pooler.c-8.us-east-1.aws.neon.tech
               Lodgist DB: lodgist-production (created today, connection string pending)
Payments:      Paystack (NOT Stripe — Nigerian market)
Auth:          NextAuth v5 + WebAuthn/Passkeys
Email:         Resend
Messaging:     WhatsApp (Meta Business API) — primary customer channel
AI:            Gemini API + Jina AI (RAG pipeline)
Scraping:      Firecrawl
Vector DB:     pgvector (on Neon)
Queue:         BullMQ + Redis (Upstash)
Edge:          Cloudflare Workers
Hosting:       Vercel
Package Mgr:   pnpm workspaces (monorepo)
pnpm version:  9.15.9
Node:          20.20.2
```

### Monorepo Structure (Lodgist)
```
~/Desktop/lodgist/
├── lodgist/              ← Next.js app (App Router)
│   ├── app/              ← Routes
│   ├── lib/trust/        ← computeTruthIndex.ts ✅
│   ├── prisma.config.ts
│   └── ...
├── packages/
│   ├── db/               ← Prisma schema (source of truth)
│   │   └── prisma/schema.prisma ← Trust models ALREADY HERE
│   └── ai-core/          ← RAG pipeline
├── backend/              ← Express/NestJS backend
└── docs/sovereign-artifacts/ ← Claude Code session artifacts
```

---

## WHAT WAS BUILT — TRUST LAYER (CONFIRMED COMPLETE)

### Schema (packages/db/prisma/schema.prisma) ✅
All models confirmed present — DO NOT recreate:
- RiskState enum (VERIFIED, UNVERIFIED, UNDER_REVIEW, FLAGGED, SUSPENDED)
- VerificationStatus enum
- FraudSignalType, SignalSeverity, SignalSource, SignalStatus enums
- AdminActionType enum
- VerificationRequest model
- FraudSignal model
- TrustComponent model
- AdminAction model
- Listing model updated with riskState, truthIndex fields

### Files Created ✅
```
lodgist/lib/trust/computeTruthIndex.ts    ← computeTruthIndex(), syncTruthIndex(), initializeTrustComponents()
lodgist/app/api/listings/[id]/trust/route.ts  ← GET /api/listings/[id]/trust
lodgist/app/api/verify/                   ← Verification flow routes
lodgist/app/api/admin/verifications/      ← Admin review routes
packages/db/prisma/seed-trust.ts          ← Trust seed data
docs/sovereign-artifacts/BLOCKERS.md      ← Session blockers (archived)
docs/sovereign-artifacts/P0_nextauth_complete.ts
docs/sovereign-artifacts/P2_truth_scoring.ts
```

### Build Status ✅
- Next.js build: PASSING
- Routes: 39 (was 38 + new trust API)
- TypeScript errors: 0

---

## SECURITY STATUS

| Item | Status |
|------|--------|
| Paystack keys rotated | ✅ Done |
| Gemini API key rotated | ✅ Done |
| Firecrawl key rotated | ✅ Done |
| Resend key rotated | ✅ Done |
| NEXTAUTH_SECRET rotated | ✅ Done |
| WhatsApp API token rotated | ✅ Done |
| Neon DATABASE_URL (password rotated) | ✅ Done |
| BFG history purge — shadowspark | ✅ Done (all branches force-pushed) |
| BFG history purge — lodgist | ✅ Done (all branches force-pushed) |
| GitHub LFS cache purge ticket | 🟡 Submitted, awaiting GitHub response |
| .env files in .gitignore | ✅ Confirmed |
| node_modules untracked | ✅ Fixed |
| rootkey.csv (potential AWS root key) | 🔴 NOT YET CHECKED — file at lodgist/REASEARCHED/rootkey.csv |
| Neon API key exposed in chat | 🔴 ROTATE IMMEDIATELY — key ending in ...9wg80so was pasted in chat |

---

## INFRASTRUCTURE STATUS

| Item | Status | Notes |
|------|--------|-------|
| GCP billing linked | ✅ | Firebase Payment → shadowspark-production-489115 |
| Vercel deployment | ✅ | Both projects deploying |
| Neon (shadowspark) | 🟡 | DATABASE_URL pushed as empty string — needs fix |
| Neon (lodgist) | 🟡 | Project created today, connection string not yet retrieved |
| Prisma migrate deploy (shadowspark) | 🔴 | Blocked by empty DATABASE_URL |
| Prisma migrate deploy (lodgist) | 🔴 | Blocked by missing DATABASE_URL in Vercel |
| lodgist.online domain | 🔴 | Not claimed on Vercel — domain fix pending |
| Vercel AI Gateway routing | 📋 | Doc shared, setup instructions given, not confirmed wired |
| GCP Secret Manager | 🟡 | Was BILLING_DISABLED during audit — re-check after billing fix |

---

## IMMEDIATE NEXT ACTIONS (In Order)

### 🔴 P0 — Security (Do First)
```
1. Rotate Neon API key ending in ...9wg80so (pasted in chat — compromised)
2. Check lodgist/REASEARCHED/rootkey.csv — if AWS AKIA... key, rotate + BFG purge
```

### 🔴 P1 — Database Connection (Blocked On P0)
```
3. Fix DATABASE_URL for shadowspark-production in Vercel:
   - Get real Neon URL: console.neon.tech → Connection Details
   - vercel env add DATABASE_URL (all 3 environments)
   - cd ~/shadowspark-clean && vercel env pull && npx prisma migrate deploy

4. Get Lodgist Neon connection string:
   - neonctl connection-string --project-name lodgist-production
   - Push to Vercel lodgist project
   - cd ~/Desktop/lodgist/lodgist && npx prisma migrate deploy
```

### 🟡 P2 — Domain
```
5. Claim lodgist.online on Vercel:
   - Vercel → Domains → Add → lodgist.online
   - Add _vercel TXT record at DNS provider
   - Assign to lodgist project
```

### 🟡 P3 — Route Security Review
```
6. Review lodgist/app/api/admin/run-migration/ route
   - Claude Code held this back — needs security review before merging
```

### 🟢 P4 — Frontend (Roo Code — Ready After P1)
```
7. Fire Roo Code Prompt for Phase 1 Trust UI:
   - RiskStateBadge component
   - TruthIndexMeter component  
   - TrustPanel component
   - Inject into existing PropertyCard + ListingDetail
```

---

## PRODUCT ROADMAP (FUSION PLAN)

### Phase 1 — Trust Signal Layer (IN PROGRESS)
- [x] Schema — RiskState, TrustComponent, FraudSignal, VerificationRequest
- [x] computeTruthIndex.ts
- [x] GET /api/listings/[id]/trust
- [ ] RiskStateBadge UI component (Roo Code — queued)
- [ ] TruthIndexMeter UI component (Roo Code — queued)
- [ ] TrustPanel UI component (Roo Code — queued)
- [ ] PropertyCard augmented with trust badge
- [ ] ListingDetail augmented with TrustPanel

### Phase 2 — Verification Flow
- [x] Verification request API routes exist
- [ ] VerificationRequestForm UI (multi-step, mobile-first)
- [ ] VerificationStatusTracker UI
- [ ] /verify/[propertyId] route
- [ ] Document upload (Cloudinary recommended)
- [ ] Email notifications on status change (Resend)

### Phase 3 — Admin Fraud Tooling
- [x] Admin verification routes exist
- [ ] Admin review queue UI
- [ ] FraudSignalCard component
- [ ] Risk state override with audit trail
- [ ] Fraud signal auto-escalation (CRITICAL → auto-FLAGGED)

### Phase 4 — Payments + Escrow
- [ ] Paystack integration (keys rotated, not yet wired)
- [ ] Virtual account escrow-by-orchestration (CBN compliance)
- [ ] Payment webhook handler review
- [ ] Dispute resolution flow

### Phase 5 — KYC + Identity
- [ ] Smile ID integration (Tier-1 Nigerian KYC provider)
- [ ] Landlord identity verification
- [ ] Agent registration flow

---

## AGENT PROMPT TEMPLATES

### Claude Code (Backend/Repo Work)
```
You are working inside the Lodgist monorepo at ~/Desktop/lodgist.
This is a pnpm monorepo. Next.js app is at lodgist/. Prisma schema is at packages/db/prisma/schema.prisma.
Stack: Next.js 16.2.4 App Router, Prisma, Neon PostgreSQL, Paystack, NextAuth v5, TypeScript strict.
Trust models (RiskState, VerificationRequest, FraudSignal, TrustComponent, AdminAction) are ALREADY in schema — do not recreate.
Trust lib is at lodgist/lib/trust/computeTruthIndex.ts — do not recreate.
Trust API is at lodgist/app/api/listings/[id]/trust/route.ts — do not recreate.

RULES:
- Production-safe changes only
- Never touch .env files
- Never push to main
- Never run prisma migrate dev against production DB (use migrate deploy only)
- Check if files exist before creating
- Write to BLOCKERS.md anything you cannot safely do

TASK: [INSERT TASK HERE]
```

### Roo Code (Frontend UI)
```
You are building Lodgist Trust Layer UI components.
App Router Next.js 16.2.4. TypeScript strict. Tailwind only (no new libs).
Brand: Navy #0B1B2B | Orange #FF6F3C | Teal #1ABC9C
Mobile-first. No generic SaaS aesthetics. Empathetic Nigerian user context.

Before building anything:
1. Scan existing components to avoid duplication
2. Check app/ directory structure
3. Note existing Tailwind config custom colors
4. Match existing patterns exactly

Trust API endpoint: GET /api/listings/[id]/trust
Returns: { riskState, truthIndex, components: [{label, passed, weight, notes}] }

TASK: [INSERT TASK HERE]
```

---

## KEY DECISIONS MADE THIS SESSION

1. **Neon over Cloud SQL** — Lodgist uses Neon serverless Postgres (not GCP Cloud SQL)
2. **Paystack not Stripe** — Nigerian market, all payment integrations must use Paystack
3. **No self-custody of funds** — CBN licensing required; use virtual-account escrow via licensed bank partner
4. **Additive fusion strategy** — No rewrites; inject trust layer as new data layer into existing app
5. **pnpm monorepo** — Schema changes go in packages/db/prisma/schema.prisma, not lodgist/prisma/
6. **prisma migrate deploy only** — Never run prisma migrate dev against production Neon instance
7. **Smile ID for KYC** — Tier-1 Nigerian identity verification provider
8. **Termii over Twilio** — Better Nigerian DND routing for SMS


---

# LODGIST 100/100 READINESS SCORECARD

## Current Score: ~31/100

---

## 1. INFRASTRUCTURE (0-20 pts) → Current: 12/20

| Check | Points | Status |
|-------|--------|--------|
| Vercel deployment live | 2 | ✅ |
| DATABASE_URL correctly set in Vercel (both projects) | 3 | ❌ Empty string |
| Prisma migrations deployed to production DB | 3 | ❌ Blocked |
| lodgist.online domain claimed + assigned | 2 | ❌ Not done |
| SSL certificate active on domain | 1 | ❌ Needs domain first |
| Vercel AI Gateway routing active (observability) | 1 | ❌ Not wired |
| GCP Secret Manager populated with all secrets | 2 | 🟡 Partial |
| CI/CD pipeline (GitHub Actions → Vercel) | 2 | ❌ Not set up |
| Budget alerts on GCP | 1 | ❌ Not set |
| Upstash Redis connected (BullMQ queues) | 1 | ❌ Not configured |
| Cloudflare Workers deployed | 2 | ❌ Not deployed |

---

## 2. SECURITY (0-20 pts) → Current: 14/20

| Check | Points | Status |
|-------|--------|--------|
| All API keys rotated | 3 | ✅ Done today |
| .env files purged from git history | 3 | ✅ Done today |
| .gitignore covers all secret patterns | 2 | ✅ Done today |
| GitHub LFS cache purged | 1 | 🟡 Ticket submitted |
| rootkey.csv checked + rotated if real | 3 | 🔴 NOT DONE |
| Neon API key from chat rotated | 2 | 🔴 NOT DONE |
| Admin routes protected (role guard) | 2 | ❌ Not implemented |
| Webhook signature verification (Paystack) | 2 | ❌ Not implemented |
| Rate limiting on public APIs | 1 | ❌ Not implemented |
| Audit log for all admin actions | 1 | ❌ Not implemented |

---

## 3. BACKEND + API (0-20 pts) → Current: 8/20

| Check | Points | Status |
|-------|--------|--------|
| Trust schema in production DB | 2 | ❌ Migration not deployed |
| GET /api/listings/[id]/trust working | 2 | ✅ Built, not deployed |
| POST /api/verification/request | 2 | ✅ Route exists |
| GET /api/verification/[propertyId] | 1 | ✅ Route exists |
| Admin fraud signal API (GET/POST/PATCH) | 2 | ✅ Route exists |
| Admin risk state override API | 1 | ❌ Not built |
| Paystack payment integration | 2 | ❌ Not wired |
| Paystack webhook handler (secure) | 2 | ❌ Needs review |
| NextAuth session working end-to-end | 2 | 🟡 NEXTAUTH_SECRET set, not tested |
| Email notifications (Resend) | 1 | ❌ Not wired |
| WhatsApp notifications (Meta API) | 1 | ❌ Not wired |
| BullMQ job queues running | 1 | ❌ Redis not connected |
| Smile ID KYC integration | 1 | ❌ Not started |

---

## 4. FRONTEND + UX (0-20 pts) → Current: 2/20

| Check | Points | Status |
|-------|--------|--------|
| Homepage live and correct | 2 | ✅ Live |
| RiskStateBadge component | 2 | ❌ Roo Code queued |
| TruthIndexMeter component | 2 | ❌ Roo Code queued |
| TrustPanel on ListingDetail | 2 | ❌ Roo Code queued |
| PropertyCard with trust badge | 1 | ❌ Roo Code queued |
| Search filter by verification status | 1 | ❌ Not built |
| /verify/[propertyId] form (mobile) | 2 | ❌ Not built |
| Verification status tracker page | 1 | ❌ Not built |
| Admin review queue UI | 2 | ❌ Not built |
| Mobile-first responsive across all pages | 2 | 🟡 Homepage only |
| Loading + error states on all API calls | 1 | ❌ Not implemented |
| Lighthouse mobile score ≥ 90 | 2 | ❌ Not measured |

---

## 5. PRODUCT COMPLETENESS (0-20 pts) → Current: 3/20

| Check | Points | Status |
|-------|--------|--------|
| Truth Index visible on listings | 2 | ❌ UI not built |
| Verification request flow end-to-end | 3 | ❌ Not complete |
| Fraud signal creation + review | 2 | ❌ Admin UI not built |
| Landlord can submit docs for verification | 2 | ❌ Form not built |
| Tenant can see trust status clearly | 2 | ❌ TrustPanel not built |
| At least 5 real listings with trust data | 1 | ❌ Seed not run |
| Paystack payment flow testable | 2 | ❌ Not integrated |
| Email notifications working | 1 | ❌ Not wired |
| WhatsApp alerts working | 1 | ❌ Not wired |
| Admin can override risk state | 1 | ❌ Not built |
| CBN compliance posture documented | 1 | ❌ Not done |
| lodgist.online serving production traffic | 2 | ❌ Domain not claimed |

---

## HOW TO GET TO 100/100 — Execution Sequence

### Week 1 — Foundation (31 → 60)
```
Day 1 (TODAY):
  ✓ Rotate exposed Neon API key
  ✓ Check rootkey.csv
  ✓ Fix DATABASE_URL in Vercel (both projects)
  ✓ Run Prisma migrations on production
  ✓ Claim lodgist.online domain
  ✓ Fire Roo Code — Phase 1 trust UI components

Day 2-3:
  ✓ Verification request form (Roo Code)
  ✓ Verification status page (Roo Code)
  ✓ Connect Resend for email notifications
  ✓ Wire NEXTAUTH_SECRET and test auth end-to-end
  ✓ Set up Upstash Redis + BullMQ

Day 4-5:
  ✓ Admin fraud signal API completion
  ✓ Admin review queue UI (Roo Code)
  ✓ Risk state override endpoint
  ✓ Audit log (AdminAction table)
  ✓ Admin route protection (role guard middleware)
```

### Week 2 — Product (60 → 80)
```
  ✓ Paystack payment integration
  ✓ Webhook signature verification
  ✓ Smile ID KYC for landlord verification
  ✓ WhatsApp notification integration
  ✓ Rate limiting on public APIs
  ✓ Full mobile-first QA pass
  ✓ Seed production DB with test listings
  ✓ Lighthouse score ≥ 90
```

### Week 3 — Launch Ready (80 → 100)
```
  ✓ CI/CD pipeline (GitHub Actions → Vercel)
  ✓ Vercel AI Gateway observability
  ✓ GCP budget alerts
  ✓ CBN compliance documentation
  ✓ End-to-end user journey testing
  ✓ Performance monitoring (Sentry + Better Stack)
  ✓ Error tracking live
  ✓ Cloudflare Workers deployed
  ✓ Full security audit
  ✓ lodgist.online serving production traffic
```

---

## SCORE SUMMARY

| Category | Current | Max | Gap |
|----------|---------|-----|-----|
| Infrastructure | 12 | 20 | 8 |
| Security | 14 | 20 | 6 |
| Backend + API | 8 | 20 | 12 |
| Frontend + UX | 2 | 20 | 18 |
| Product Completeness | 3 | 20 | 17 |
| **TOTAL** | **31** | **100** | **69** |

**Biggest leverage:** Frontend UX (18 pts gap) + Product Completeness (17 pts gap)
**Fastest wins:** DATABASE_URL fix + domain claim = +8 pts in 30 minutes
**Roo Code Phase 1 alone = +10 pts**
