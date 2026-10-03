# Priority Scale — Lodgist Overnight, 2026-09-27

## What this is
A ranked ordering of the things the overnight prompt asked for (Obj 1-5) plus the unresolved items from the strip session, in priority order. Each item carries a decision-model rubric so Jev can score it when the TypeSafe key is available.

## Priority 1 — Launch the overnight run (highest)
**Why first:** Everything else depends on the evidence the overnight agent produces. Waiting adds no value; the prompt is already written, committed, and pushed.

**State:** `docs/AUTONOMOUS_NIGHT_2026-09-27.md` exists on `cursor/overnight-2026-09-27`, tmux session `overnight` exists but the prompt was only pasted in — the agent was still loading context when the session ended. It never executed a single objective.

**Decision model (what "launch" requires):**

| Criterion | Threshold | Current |
|---|---|---|
| Prompt file exists and is self-contained | Must exist, must not read truth pointer | ✅ 5e2f85b0, no CONTEXT-TRANSFER dependency |
| Branch is safe | Must be a new cursor/* branch, not prod-config | ✅ cursor/overnight-2026-09-27 |
| Tier budgets are sufficient for the model | Tier 1 ≥ 8, Tier 2 ≥ 2 for a useful run | ✅ 12 / 3 (designed for solar-pro4:free) |
| Model can reach the repo and endpoints | Codebase accessible, URLs reachable | ✅ repo at ~/src/lodgist, endpoints are public |
| No Tier 3 action is required to start | If yes, stop and write NEEDS-HUMAN.md | ✅ none required |
| Secrets are not load-bearing for the read-only objectives | If a secret is required, flag it | ✅ Obj 1-2 are read-only, no secrets needed |
| Tmux session is detached and waiting | Session must exist and accept input | ✅ `tmux ls` showed `overnight: 1 windows` |

**Verdict gate:** If all rows are ✅, launch. If any row is ❌, write to NEEDS-HUMAN.md and stop.

---

## Priority 2 — Run the Tier 0 objectives (read-only evidence)
**Why second:** Obj 1 (verify 3 URLs) and Obj 2 (grep for payment artifacts) are free — Tier 0, unlimited. They produce the evidence everything else depends on. Do them the moment the overnight agent starts.

**Obj 1 — VERIFY:**
- `curl -si https://lodgist.online | head -5`
- `curl -si https://lodgist-api-production.up.railway.app/api/health | head -5`
- `curl -si https://lodgist.online/api/health | head -5`
- Write to `docs/ops/2026-09-27-verify.md`

**Obj 2 — REVENUE AUDIT:**
- grep for: paystack, flutterwave, stripe, checkout, payment, subscription, commission, escrow, wallet, invoice, receipt, verification
- Report every file:line hit
- Identify the payment provider (if any)
- Write to `docs/ops/2026-09-27-revenue-audit.md`

**Existing partial results (from this session, already in the repo):**
- `docs/ops/2026-09-27-revenue-audit.md` — already written (6959 bytes, from the earlier overnight attempt)
- `docs/ops/2026-09-27-verify.md` — already written (2863 bytes)
- `docs/ops/2026-09-27-commission-model.md` — already written (15102 bytes)
- `docs/ops/2026-09-27-MORNING-BRIEF.md` — already written (7962 bytes, from the earlier attempt)
- `docs/ops/2026-09-27-admin-ui-gap.md` — written this session (admin dashboard is stats-only, no payment verification UI)
- `docs/ops/2026-09-27-secret-hygiene.md` — written this session (F4 held, no live secrets in git)

**Decision for the overnight agent:** If the existing ops files are from a previous run and are still accurate, the agent can read them and cite them rather than re-grepping from scratch. The prompt doesn't forbid reading prior ops files — only forbids reading CONTEXT-TRANSFER.md. Decide: re-grep or cite? Either is Tier 0.

---

## Priority 3 — Draft ONE plan (Tier 1)
**Why third:** Obj 3 depends on Obj 2's output. You can't choose plan A/B/C until you know whether a payment provider is wired.

**The three options:**
- **A. Payment plan** — if NO provider is wired. Propose Paystack or Flutterwave. Include env var NAMES (not values), webhook path, idempotency, test/live split, rollback.
- **B. Commission plan** — if a provider IS wired. Propose commission structure with Nigerian competitor reference (MyAgent 20%, Topdial 5-10%, HomeLands 1%). Defend one.
- **C. Verification plan** — if NEITHER exists. Propose verified-listing flow: who pays, what evidence is kept, how audited.

**Decision model for which plan to draft:**

| Criterion | A (payment) | B (commission) | C (verification) |
|---|---|---|---|
| A payment provider is wired in the codebase | ❌ required | ✅ required | ❌ allowed |
| A payment provider has live keys on the hosting service | ❌ doesn't matter for the plan | ⚠️ matters for feasibility | ❌ doesn't matter |
| Commission structure is already documented | ❌ irrelevant | ✅ must be absent or stale | ❌ irrelevant |
| Verified-listing flow is already built | ❌ irrelevant | ❌ irrelevant | ⚠️ must be absent or partial |

**Current known state (from this session):**
- `lodgist-api` Railway service has ZERO `PAYSTACK_*` env vars (confirmed via `railway variable list`)
- `lodgist` Railway service does NOT have `PAYSTACK_*` vars in the F32 list
- `backend/.env.example` has `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` placeholders
- `render.yaml` has `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` but marked `sync: false`
- `backend/__tests__/setup.js` sets a redacted test placeholder
- Payment routes exist: `/api/payments` (webhook), `/api/bookings` (manual-payment, verify-payment)
- Manual payment path is built and tested: tenant/admin submits bank-transfer ref → `PENDING_VERIFICATION` → admin approves → `CONFIRMED`
- No Paystack/Flutterwave/Stripe integration is wired — no provider keys, no webhook registration, no initialize/verify flow

**Verdict:** This points to **Plan A (payment plan)** — no provider is wired, the manual path exists as a stopgap, and the first revenue move is to wire Paystack (the Nigerian market default) with keys on the Railway service. Plan B is premature (no provider to commission). Plan C is partially done (manual verification exists; the gap is the admin UI to call it, documented in `docs/ops/2026-09-27-admin-ui-gap.md`).

---

## Priority 4 — Write patches (Tier 1)
**Why fourth:** Obj 4 depends on Obj 3's plan. Patches are always Tier 1 (write file, no service impact). Each patch must have: exact file path, exact diff, rollback command, verification command. Do NOT apply.

**Expected patches for Plan A:**
1. Add `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` env var placeholders to `docs/contracts/lodgist-api.env.template` (marked `<ROTATE>`)
2. Wire the Paystack initialize/verify flow in `backend/src/routes/payments.js` (if the route exists but is a stub)
3. Register the webhook path in the booking flow so payment success triggers booking confirmation
4. Idempotency guard on the webhook handler (dedupe by reference)

**Do NOT patch until Obj 3 is written and the plan is known.**

---

## Priority 5 — Write the morning brief (Tier 1)
**Why fifth:** Obj 5 is the deliverable. It summarizes everything: what changed, what was verified, what's pending, three decisions the founder must make, Tier 3 items flagged with exact commands, and the last line exactly `NOW — <state> · next: <action>`.

**The three decisions the brief must surface (from current state):**

1. **Wire Paystack keys now, or wait?** — The manual payment path works but requires admin action per booking. Paystack keys would automate payment confirmation. Wire now (Tier 2 — env vars on existing Railway service, documented rollback = remove the vars) or wait until after private beta validation?

2. **Build the admin payment verification UI, or keep curl?** — The backend routes are wired (`PATCH /api/bookings/:id/verify-payment`), but there's no admin UI to call them. The admin dashboard at `lodgist/app/dashboard/admin/page.tsx` is stats-only. Building the UI is a half-day Next.js app-router page. Build now (Tier 1 — write file) or defer to Phase 4?

3. **Proceed to private beta with the manual path as-is, or block on payment automation?** — BETA_STATUS.md (2026-05-19) says GO with manual payment as a beta-scope item. The manual path is verified live against Neon. Does the founder want to launch the beta on the manual path, or does payment automation need to be in place first?

---

## Priority 6 — Re-dispatch the 9 dimension audits (deferred)
**Why last:** The 9 audits (Backend/API, DB/Schema, Frontend/UI, Security, Payments/Revenue, Trust/Verification, Infra/Deployment, Governance/Docs, Track B/Domain) all failed with HTTP 429. They were supposed to produce A+ rubrics + current grades + gap lists. Nothing came back except what was written directly this session (secret hygiene, admin UI gap).

**Re-dispatch strategy:** 2-3 agents at a time, not 9. The rate limit is the binding constraint. Suggested order:
1. Backend/API + Security (most decision-relevant)
2. Payments/Revenue + Trust/Verification (revenue-critical)
3. DB/Schema + Infra/Deployment + Governance/Docs + Frontend/UI + Track B (lower urgency)

**Pre-requisite:** The overnight run should finish (or be stopped) before re-dispatching — the audit agents will want the overnight evidence as input. Running them in parallel with the overnight agent risks both hitting 429.

---

## Priority 7 — Jev/TypeSafe key provisioning (meta)
**Why last (meta):** Jev is the decision model the user asked for. It's unwired. The TypeSafe key is created offline at console.typesafe.ai and added to `~/.hermes/.env` as `TYPESAFE_API_KEY`. Once it's present, the rubrics above become runnable Jev questions.

**What changes when the key is present:**
- Each ✅/⚠️/❌ table above becomes a `jev_evaluate` call with `noul`/`choice`/`score` questions
- The three founder decisions (Priority 5) become `jev_route` calls with the options as mutually exclusive choices
- The plan selection (Priority 3) becomes a `jev_score` against the A/B/C rubric

**Until the key is present:** the rubrics are written but not run. The decision logic is explicit and verifiable — a future Jev call should reproduce the same verdicts if the state hasn't changed.

---

## What's NOT on the priority scale

- **DeepSeek as a Jev substitute** — explicitly off. Session memory: "a DeepSeek stand-in for Jev decisions was aborted. Do not call api.deepseek.com for decisions, and do not substitute the DeepSeek key for a different provider's key."
- **Restore the truth pointer** — explicitly off. The strip session's conclusion was "ship a prompt that doesn't need the file," which is done.
- **Tier 2/3 actions** — no railway delete, no DNS, no force push, no prod-config push, no secret reads. If any of these seem necessary, write to NEEDS-HUMAN.md and stop.

---

## Summary ranking

| Rank | Item | Tier | Depends on | Blocking |
|---|---|---|---|---|
| 1 | Launch overnight run in tmux | Tier 0 to start | Prompt file exists, session exists | None |
| 2 | Obj 1 + Obj 2 (verify + grep) | Tier 0 | Nothing | None |
| 3 | Obj 3 (draft ONE plan) | Tier 1 | Obj 2 output | Obj 2 |
| 4 | Obj 4 (write patches) | Tier 1 | Obj 3 | Obj 3 |
| 5 | Obj 5 (morning brief + 3 decisions) | Tier 1 | Obj 1-4 | Obj 1-4 |
| 6 | Re-dispatch 9 audits (2-3 at a time) | Tier 1 | Overnight done (ideally) | Overnight + rate limit |
| 7 | Provision TypeSafe key for Jev | Meta | User creates key offline | User action |
