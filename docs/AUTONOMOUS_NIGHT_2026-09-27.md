═══════════════════════════════════════════════════════════════
AUTONOMOUS OVERNIGHT — LODGIST REVENUE EVIDENCE GATHERING
Authorization: moronto, founder, ShadowSpark Technologies
Date: 2026-09-27 (WAT, UTC+01:00)
Companion docs: docs/TRACK_B.md (read this)
Do NOT read docs/CONTEXT-TRANSFER.md — it is under repair and its
current content is not authoritative for this run.
═══════════════════════════════════════════════════════════════

## §1 — FOUNDER'S ORDER
I am sleeping. Produce evidence, not deploys. When I wake I want:
  1. Every revenue-critical endpoint verified healthy, with timestamps
  2. Every payment/commission/verification artifact in the codebase inventoried
  3. One clear path to first revenue drafted, with rollback and verification
  4. Three decisions I must make, in priority order
  5. Zero unauthorized state change

If uncertain: write to NEEDS-HUMAN.md and skip. Do not guess.

## §2 — TIERS
  Tier 0 (read-only): unlimited. Execute freely.
  Tier 1 (reversible: write file, kanban card, non-secret env): budget 12.
  Tier 2 (service-affecting: redeploy, env on existing service, git push
    to a cursor/* branch): budget 3. Requires documented rollback.
  Tier 3 (destructive: delete, DNS, credential rotation, force push,
    anything touching volume 26779798-f32c-4743-8b90-37b04ef0ded3):
    NEVER. Write to NEEDS-HUMAN.md instead.

## §3 — FORBIDDEN (hard)
  F1. No `railway delete` of any kind
  F2. No DNS changes
  F3. No touching volume 26779798-f32c-4743-8b90-37b04ef0ded3
  F4. No printing/echoing/committing any secret value
  F5. No `git push --force`
  F6. No edits to .github/workflows/
  F7. No `railway init`
  F8. No creating services
  F9. No changes to JWT_SECRET, NEXTAUTH_SECRET, DATABASE_URL
  F10. No `git push` to cursor/lodgist-prod-config-4cbdd — push only to
       a new branch named `cursor/overnight-2026-09-27`
  F11. No reading .env, .env.*, or *.authkey contents
  F12. No resolving or visiting non-canonical hosts
  F13. No actions on Track B (Vercel, morontomornica7 workspace)

If unsure: forbidden. Stop.

## §4 — OBJECTIVES (in order)

### Objective 1 — VERIFY (read-only)
For each URL, run `curl -si <url> | head -5`. Record status, content-type,
first body line.
  - https://lodgist.online
  - https://lodgist-api-production.up.railway.app/api/health
  - https://lodgist.online/api/health
Write to docs/ops/2026-09-27-verify.md

### Objective 2 — REVENUE AUDIT (read-only)
Grep the codebase for: paystack, flutterwave, stripe, checkout, payment,
subscription, commission, escrow, wallet, invoice, receipt, verification.
Report every file:line hit. Identify the payment provider (if any).
Write to docs/ops/2026-09-27-revenue-audit.md

### Objective 3 — DRAFT ONE PLAN (Tier 1)
Based on Obj 2, write EXACTLY ONE of:
  A. docs/ops/2026-09-27-payment-plan.md — if no provider is wired,
     propose Paystack or Flutterwave integration. Include required env
     var NAMES (not values), webhook path, idempotency approach,
     test/live split, rollback.
  B. docs/ops/2026-09-27-commission-plan.md — if a provider is wired,
     propose the commission structure with reference to Nigerian
     competitors (MyAgent 20%, Topdial 5-10%, HomeLands 1%). Defend one.
  C. docs/ops/2026-09-27-verification-plan.md — if neither exists,
     propose the verified-listing flow. Who pays, what evidence is kept,
     how it is audited.

### Objective 4 — PATCH DRAFTS (Tier 1)
Write ready-to-apply patches to docs/patches/ for the Obj 3 deliverable.
Each patch: exact file path, exact diff, rollback command, verification
command. Do NOT apply.

### Objective 5 — BRIEF (Tier 1)
Write docs/ops/2026-09-27-MORNING-BRIEF.md:
  - One paragraph on what changed
  - One table: action, tier, resource, outcome
  - Three decisions I need to make
  - Tier 3 items flagged with exact commands
  - Last line exactly: `NOW — <state> · next: <action>`

## §5 — VERIFICATION
After every Tier 2 action: run the verification you declared BEFORE
executing. If verification fails, revert once and log. Do not retry twice.

## §6 — ROLLBACK
Before every Tier 2 action, write rollback to docs/ops/rollback-<action>.md.
Format: `Action: <cmd> / Rollback: <cmd> / Tested: yes|no`.
If rollback is not tested: downgrade the action to Tier 3 and skip.

## §7 — CHECKPOINTS
After each objective, append one line to docs/ops/2026-09-27-checkpoints.md:
  `<ISO8601> | <objective> | <status> | <artifacts> | <next>`
If you crash and restart, read this file first.

## §8 — AUTONOMY BUDGET
  Tier 0: unlimited
  Tier 1: 12 actions
  Tier 2: 3 actions
  Tier 3: 0
Every Tier 1 and 2 action → one line to ~/.hermes/audit.jsonl:
  {"ts":"<ISO8601Z>","agent":"hermes-overnight","action":"<type>",
   "tier":N,"resource_ids":[...],"justification":"Obj<N>",
   "rollback_documented":"yes|no","outcome":"success|fail|skipped",
   "budget_remaining":{"tier1":N,"tier2":N}}

## §9 — QUOTA DISCIPLINE
If model returns 429/529: wait 60s, retry once. If it fails again:
  write current state to checkpoint, write to NEEDS-HUMAN.md, STOP.
Do not thrash. Do not loop. Every 30 min append a heartbeat to
docs/ops/2026-09-27-heartbeat.md.

## §10 — STOP CONDITIONS
Stop and write to NEEDS-HUMAN.md if:
  - Any Tier 3 action seems necessary
  - Any F1–F13 violation seems necessary
  - Two consecutive Tier 2 rollbacks fail
  - Audit log cannot be written
  - You cannot identify the next action after 5 minutes
  - A secret appears in any file (log the fact, not the value)

═══════════════════════════════════════════════════════════════
FOUNDER'S FINAL LINE
Evidence, not activity. Tomorrow I approve. Sleep is the reward.
═══════════════════════════════════════════════════════════════