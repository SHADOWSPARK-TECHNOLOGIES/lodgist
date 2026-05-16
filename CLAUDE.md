# CLAUDE.md — ShadowSpark + Lodgist Operating Context

## Identity
ShadowSpark Technologies is the parent company / AI studio / product builder.
Lodgist is the active flagship product: a Nigeria-focused verified property and service platform built to reduce fraud, middleman abuse, and trust failure in housing transactions.

## Product Positioning
Lodgist = "Verified Property. Zero Fraud."
This is not just a listings app.
It is a trust infrastructure platform combining verification, anti-fraud scoring, escrow-style payment protection, and operational trust workflows.

## Founder Working Style
The founder is highly technical, fast-moving, and prefers direct execution-ready output.
Do not over-explain basics.
Lead with the best answer, then tradeoffs, then exact next action.
Always optimize for launch readiness, leverage, correctness, and speed.

## Repo Reality
This repo includes multiple active surfaces:
- Lodgist app
- Frontend
- Backend
- AI Core
- Prisma/database layer
- Infra/AWS-related deployment surfaces

All 4 local services have already been run successfully under debugger:
- Lodgist app: 3000
- Frontend: 3001
- Backend: 4000
- AI Core: 4001

## Current State
Shipped:
- v5 Executive Tier: passkey/FIDO2 auth, HNW liveness gate, TruthIndex, RBAC, escrow architecture, CI/CD, production hardening
- v6 Market-Ready Frontend: landing page, listings, login/register, dashboard route, TruthScore UI, toast system, WhatsApp entry, frontend polish

## Current Launch Blockers
- Two incompatible Prisma schemas
- Missing backend JWT_SECRET
- Missing Paystack keys
- No Paystack webhook endpoint
- CORS too loose
- GitHub/Google OAuth config incomplete
- WebAuthn origin/runtime mismatch
- Domain/runtime env cleanup incomplete
- WhatsApp/public URLs still need env-driven cleanup

## Architecture Bias
Do not recommend toy architecture.
Do not rush dangerous schema unification unless clearly justified.
Prefer:
1. quick patch
2. proper production fix
3. ideal long-term architecture

Always separate those three.

## Default Execution Priorities
1. env/auth/payment blockers
2. domain/runtime cleanup
3. Paystack hardening
4. WhatsApp integration
5. admin/trust workflows
6. growth systems

## Non-Negotiable Rules
- Inspect the real repo before recommending major changes.
- Keep edits surgical unless a rewrite is clearly worth it.
- Flag blast radius before changing schemas, auth, payments, or infra.
- Never invent credentials, ARNs, secrets, callback URLs, or database values.
- For AWS work, prefer read-only inspection first, then change commands, then verification.
- For payments, always reason about webhook safety, idempotency, reconciliation, and rollback.
- For auth, always reason about origin, secrets, session flow, role mapping, and runtime environment.

## Custom Agents
Use these mental roles when solving tasks:
- @cto-architect
- @repo-cartographer
- @frontend-next
- @backend-express
- @db-prisma
- @payments-paystack
- @auth-security
- @aws-devops
- @qa-playwright
- @research-ops
- @growth-ops

## Custom Skills
These are preferred reusable workflows:
- /plan-sprint
- /schema-decision
- /paystack-hardening
- /auth-runtime-audit
- /seed-and-fixtures
- /whatsapp-integration
- /aws-deploy-check
- /security-review
- /code-review
- /release-readiness

## How to Respond
For architecture tasks:
- Recommend the best option first
- Then alternatives
- Then risks
- Then implementation order

For debugging tasks:
- Rank root-cause hypotheses by probability
- Give exact files and commands to inspect
- Give verification steps
- Avoid broad speculation

For implementation tasks:
- State objective
- List files/systems affected
- List dependencies
- List failure modes
- Give exact step-by-step order
- End with verification checklist

## Product/Market Lens
Always remember:
- Lodgist is Nigeria-first
- mobile-first and trust-first
- anti-fraud and payment safety matter more than vanity features
- growth should favor low-budget viral or distribution-efficient tactics
- recommendations must fit startup constraints
