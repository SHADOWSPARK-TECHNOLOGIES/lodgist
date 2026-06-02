# BLOCKERS — Sovereign Session 2026-06-02 12:56 WAT

These items were **not executed** because they hit one of the session's own STOP rules
("anything that touches existing production data") or because the runbook's premise was
already satisfied / its file paths do not match this monorepo. Founder review required.

---

## B1 — Phase 2 migration NOT run (already done + targets PRODUCTION DB)
- **Premise stale:** All target models/enums already exist in `packages/db/prisma/schema.prisma`:
  `RiskState`, `VerificationStatus`, `FraudSignalType`, `SignalSeverity`, `SignalSource`,
  `SignalStatus`, `AdminActionType`, `VerificationRequest`, `FraudSignal`, `TrustComponent`,
  `AdminAction`. The runbook's own guard ("IF NONE OF THESE EXIST yet") → skip.
- **Production risk:** `DATABASE_URL` resolves to a live Neon instance
  (`ep-proud-resonance-...aws.neon.tech`). `prisma migrate dev` is documented as never-safe
  against production (it can reset/drop data on drift). This is the session STOP rule.
- **Decision:** Skipped. If a new migration is ever needed, generate SQL with
  `prisma migrate diff` and apply via `prisma migrate deploy` against a **non-prod** branch first.

## B2 — Phase 3 files NOT created (already implemented, and runbook paths are wrong)
- Already present:
  - `lodgist/lib/trust/computeTruthIndex.ts`
  - `lodgist/app/api/listings/[id]/trust/route.ts` (also compiled in `.next/`)
  - plus `lodgist/app/api/verify`, `app/api/admin/verifications`, `app/api/listings/[id]/verify`
- Runbook assumed repo-root `lib/`, `app/`, `prisma/`. This is a **pnpm monorepo**; root has none
  of those. Writing there would create orphaned duplicates.
- **Decision:** Skipped to avoid duplicate/divergent code.

## B3 — Phase 4 seed NOT run (already exists + mutates production data)
- `packages/db/prisma/seed-trust.ts` already exists.
- Running any seed connects to and writes the production Neon DB → session STOP rule.
- **Decision:** Skipped.

## B4 — Git push withheld (both repos)
- Founder unavailable; both working trees are in a **mixed/messy state**:
  - `shadowspark-clean`: untracked junk (`Downloading`, `Overwriting`, `build-fix`, `err.txt`,
    `chatbot/`) alongside real edits — not safe to auto-commit wholesale.
  - `lodgist`: staged mass-deletion of committed `backend/node_modules` + staged **binary zips**
    (`docs/files.zip`, `docs/files (1).zip`) + `docs/ROO_SOVEREIGN_AUTOMATION*.md`.
- Pushing is outward-facing and not cleanly reversible. **Decision:** left uncommitted for
  founder to triage. No commit, no push made this session.

## B5 — SECURITY: likely-committed credential file
- `lodgist/REASEARCHED/rootkey.csv` — filename pattern of an **AWS root access-key CSV**.
  Not opened/exfiltrated. **Action for founder:** confirm contents, rotate the key if real,
  remove from working tree, and purge from git history if it was ever committed.

## B6 — GCP billing disabled (recon limitation, not a blocker to fix here)
- `gcloud secrets list` failed: `BILLING_DISABLED` on project `shadowspark-production-489115`.
  Secret Manager audit could not complete. Cloud Run services were still enumerable (5, all healthy).
