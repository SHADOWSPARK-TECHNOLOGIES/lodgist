# Jev Decision Model — Ready-to-Run Questions

## When the TypeSafe key is present

Add `TYPESAFE_API_KEY=<key>` to `~/.hermes/.env`, then run these.
Each block is one `jev_evaluate` call — copy the `state` and `questions` verbatim.

---

## Call 1 — Launch gate

```json
{
  "state": "OVERALL STATE (2026-09-27, WAT):\n\nProfile: coder exists at ~/.hermes/profiles/coder, model upstage/solar-pro4:free (nous), alias 'coder' in PATH.\n\nOvernight prompt: docs/AUTONOMOUS_NIGHT_2026-09-27.md written, committed (5e2f85b0), pushed to branch cursor/overnight-2026-09-27. Truth-pointer-independent v2. Explicitly says DO NOT read docs/CONTEXT-TRANSFER.md.\n\nTmux session 'overnight' exists but the prompt was only pasted in; the agent was still loading context when the session ended. It never executed a single objective.\n\nThe user asked (message 1100 of strip session) to use a decision model. Jev is unwired pending the TypeSafe key. DeepSeek is NOT a Jev substitute (aborted in session memory).\n\nWhat IS available: coder profile (solar-pro4:free via Nous), Jev plugin tools, the overnight prompt file, the repo at ~/src/lodgist.\n\nObjectives: (1) verify 3 URLs, (2) grep for payment artifacts, (3) draft ONE plan from the grep, (4) write patches, (5) write morning brief with 3 decisions.\n\nForbidden: no railway delete, no DNS, no secrets, no force push, no .env reads, no prod-config push — push only to cursor/overnight-2026-09-27.\n\nBudget: Tier 0 unlimited, Tier 1 = 12, Tier 2 = 3, Tier 3 = 0.\n\nBuilt artifacts: docs/ops/2026-09-27-secret-hygiene.md, docs/ops/2026-09-27-admin-ui-gap.md (both confirmed read-only findings). 9 audit subagents failed with HTTP 429 — no audit results.\n\nExisting ops files from a prior run: 2026-09-27-verify.md, 2026-09-27-revenue-audit.md, 2026-09-27-commission-model.md, 2026-09-27-MORNING-BRIEF.md. The overnight agent may read these or re-grep.\n\nPayment state: lodgist-api Railway service has ZERO PAYSTACK_* env vars. No provider is wired. Manual payment path exists and is verified live against Neon. backend/.env.example and render.yaml have PAYSTACK placeholders but no live keys.",
  "questions": {
    "launch_safe": {
      "instructions": "Is the overnight prompt safe to launch right now without any further changes? Consider: the prompt file exists and is self-contained, the branch is a new cursor/* branch (not prod-config), the tier budgets (Tier 1=12, Tier 2=3) are sufficient for solar-pro4:free, the tmux session exists and is waiting, no Tier 3 action is required to start, and the read-only objectives need no secrets.",
      "type": "noul"
    },
    "next_action": {
      "instructions": "What should happen next, right now? Choose exactly one.",
      "type": "choice",
      "criteria": {
        "relaunch_overnight": "Re-paste the prompt into the existing tmux overnight session and let it run to completion. This is the right choice if the prompt is ready and the session is waiting.",
        "write_priority_scale_first": "First write a priority scale document, then relaunch. Choose this if the decision logic needs to be explicit and verified before the agent runs.",
        "abandon_for_now": "Do not launch. Sleep now, deal with it tomorrow. Choose this if launching on solar-pro4:free is too risky or if the prompt is not ready."
      }
    },
    "plan_selection": {
      "instructions": "Based on the current payment state (no provider wired, no live keys, manual path exists and is verified), which plan should the overnight agent draft? Choose exactly one.",
      "type": "choice",
      "criteria": {
        "plan_a_payment": "Plan A — payment plan. Propose Paystack or Flutterwave integration. Env var NAMES (not values), webhook path, idempotency, test/live split, rollback. Choose this if NO provider is wired and the first revenue move is to wire one.",
        "plan_b_commission": "Plan B — commission plan. Propose commission structure with Nigerian competitor reference (MyAgent 20%, Topdial 5-10%, HomeLands 1%). Defend one. Choose this ONLY if a provider is already wired.",
        "plan_c_verification": "Plan C — verification plan. Propose the verified-listing flow: who pays, what evidence is kept, how audited. Choose this if NEITHER a provider nor a commission structure exists."
      }
    }
  }
}
```

---

## Call 2 — Founder decisions (after the overnight run produces evidence)

```json
{
  "state": "FOUNDER DECISIONS — to be evaluated after the overnight run completes.\n\nContext: Lodgist is a Nigerian proptech platform. Manual payment path works (tenant/admin submits bank-transfer ref → PENDING_VERIFICATION → admin approves → CONFIRMED). Backend routes are wired. No Paystack/Flutterwave/Stripe integration is wired — no provider keys, no webhook registration.\n\nThe admin dashboard at lodgist/app/dashboard/admin/page.tsx is stats-only. There is no UI to view the PENDING_VERIFICATION queue or approve/reject payments. The verify-payment route exists and is tested via curl.\n\nBETA_STATUS.md (2026-05-19) says GO with manual payment in beta scope.\n\nThree decisions the founder must make.",
  "questions": {
    "decision_1_wire_paystack": {
      "instructions": "Should Paystack keys be wired on the Railway service now, or wait until after private beta validation? Wire now = Tier 2 (env vars on existing service, rollback = remove the vars). Wait = keep the manual path as-is. Consider: the manual path works but requires admin action per booking; automation reduces admin load but introduces a payment provider dependency.",
      "type": "choice",
      "criteria": {
        "wire_now": "Wire Paystack keys now. The manual path is a stopgap; automation is the real flow. Accept the provider dependency.",
        "wait_after_beta": "Wait until after private beta. Validate the manual path with real tenants first, then wire Paystack. Lower risk, slower.",
        "never_wire": "Do not wire a payment provider. Keep the manual path permanently. Choose only if the founder has a reason to avoid payment automation entirely."
      }
    },
    "decision_2_admin_ui": {
      "instructions": "Should the admin payment verification UI be built now, or deferred to Phase 4? Build now = Tier 1 (write a Next.js app-router page that calls GET /api/bookings?status=PENDING_VERIFICATION and PATCH /api/bookings/:id/verify-payment). Defer = keep using curl. Consider: the backend routes are ready; the UI is a half-day build; the admin currently has no way to approve payments without curl.",
      "type": "choice",
      "criteria": {
        "build_now": "Build the admin UI now. The backend is ready; the UI is the only thing between 'backend ready' and 'admin can collect revenue without curl'.",
        "defer_to_phase4": "Defer to Phase 4. The manual path works via curl for now; build the UI when the admin dashboard is a higher priority.",
        "build_minimal": "Build a minimal version — just the PENDING_VERIFICATION queue and approve/reject buttons, nothing else. Faster than the full dashboard page."
      }
    },
    "decision_3_beta_go": {
      "instructions": "Should private beta proceed on the manual payment path as-is, or should payment automation be in place first? GO = launch beta with manual payments, accept the admin overhead. BLOCK = hold beta until Paystack is wired and the admin UI exists. Consider: BETA_STATUS.md says GO; the manual path is verified live; the beta scope explicitly includes manual payment submission and admin verification.",
      "type": "choice",
      "criteria": {
        "go_on_manual": "Proceed to private beta on the manual path. The manual flow is verified, beta scope includes it, and automation can come after validation.",
        "block_on_automation": "Block beta until Paystack is wired and the admin UI exists. Automation is a prerequisite, not a post-launch improvement.",
        "go_with_caveat": "Proceed to beta on the manual path, but with an explicit timebox — if automation is not wired within N weeks, revisit."
      }
    }
  }
}
```

---

## Call 3 — Audit re-dispatch order (if re-dispatching)

```json
{
  "state": "9 dimension audits were dispatched and all failed with HTTP 429. Re-dispatch is needed but the rate limit is the binding constraint.\n\nThe dimensions: Backend/API, DB/Schema, Frontend/UI, Security, Payments/Revenue, Trust/Verification, Infra/Deployment, Governance/Docs, Track B/Domain.\n\nContext: the overnight run may or may not have completed. The secret hygiene and admin UI gap findings are already written. The repo is at ~/src/lodgist.",
  "questions": {
    "batch_order": {
      "instructions": "In what order should the 9 audits be re-dispatched, in batches of 2-3, to stay under the rate limit? Choose the batch that should go first.",
      "type": "choice",
      "criteria": {
        "batch_1_backend_security": "Batch 1: Backend/API + Security. These are the most decision-relevant dimensions and their findings feed the other audits.",
        "batch_1_payments_trust": "Batch 1: Payments/Revenue + Trust/Verification. These are revenue-critical and the overnight run's Obj 2/3 depend on them.",
        "batch_1_all_read_only": "Batch 1: all 9 at once but with a longer retry delay (120s instead of 60s). Risky but faster if the rate limit is per-minute rather than per-hour."
      }
    },
    "wait_for_overnight": {
      "instructions": "Should the audits wait for the overnight run to finish before re-dispatching, or run in parallel? Wait = audits use overnight evidence as input. Parallel = audits run independently but risk both hitting 429.",
      "type": "noul"
    }
  }
}
```

---

## How to run

```bash
# One-shot Jev evaluate (no interactive chat)
hermes chat -q '
{
  "state": "...",
  "questions": { ... }
}'
```

Or paste the JSON into a `coder chat` session and let it call the Jev tools directly.

## Expected output shape

Each question returns:
- `noul`: `yes_probability` (0-1)
- `choice`: `choice` (the winning option key), `probabilities` (per-option), `confidence`
- `score`: `score` (numeric index into the levels array), `legend` (per-level description), `confidence`

Combine the answers yourself — Jev does not reason across questions, it evaluates each independently against the same state.
