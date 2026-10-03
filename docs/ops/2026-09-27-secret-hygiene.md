# Secret Hygiene — Confirmed Findings (2026-09-27)

## What's in git (read-only sweep)

### .env files tracked by git (all templates/examples, no live values)
- `backend/.env.example` — template with redacted placeholders (`«redacted:sk_live_…»`, `«redacted:sk-…»`, `your-*` values). No real secrets.
- `docs/contracts/lodgist-api.env.template` — Railway API service template. Values marked `<ROTATE>`. No real secrets.
- `packages/db/.env.example` — DB connection template with redacted host. No real secrets.

**Judgment:** these three are correct. They are templates, not live env files. No action beyond confirming they stay `.example`/`.template` and never get filled in.

### Secret-pattern hits (outside node_modules) — none are live values
- `.github/copilot-instructions.md` — instructional prose describing key formats (`sk-...`, `sk_live_...`). Not a value.
- `APPRUNNER_DEPLOY.md` line 57 — JSON example with `sk_live_...` placeholder. Not a value. Flagged earlier: confirm it stays a placeholder, not the real key copied from somewhere.
- `backend/.env.example` — redacted placeholders. Not values.
- `backend/__tests__/setup.js` line 7 — `process.env.PAYSTACK_SECRET_KEY = "«redacted:sk_test_…»";` A test setup convention. Not a real key. Worth confirming no integration test treats this as a real value.

**Judgment:** F4 held. No live secret is readable from the repo.

## What's NOT in git (confirmed absent — good)
- No `.env`, `.env.production`, `.env.local`, or any filled env file is tracked.
- No `lodgist-deploy-key.json` or `lodgist-key.json` is tracked (referenced in `.github/copilot-instructions.md` as existing at a path, but the file itself is gitignored).

## What the live services actually have (separate from git — checked this session)
- `lodgist-api` Railway service: zero `PAYSTACK_*` env vars (checked via `railway variable list --service lodgist-api`). Keys absent.
- `lodgist` Railway service: `PAYSTACK_*` vars not present in the F32 variable list.
- GitHub token (`github.authkey`): still live in history, PR #6 open and unmerged.

## A+ criterion
An A+ secret posture means:
1. No live secret is committed to git (pass — confirmed this session).
2. No live secret appears in any code file, test setup, or docs file as a real value (pass — all hits are redacted placeholders or instructional prose).
3. Every live secret on every service is trackable (unknown — Track B rotates not yet done; `github.authkey` still live).
4. Test fixtures never embed real-looking keys that could be confused with production (near-pass — `setup.js` uses a clearly-redacted placeholder; confirm no test treats it as real).

## Gap
- `github.authkey` still live in git history (PR #6 unmerged). Tier 2/3 — founder action in GitHub UI.
- Track B rotation not started (T3.2). Founder action, multi-session.
- Confirm `APPRUNNER_DEPLOY.md` line 57 is a placeholder and never the real key (read-only check, but the real key would be on the AWS side — founder confirmation).

## Status
Confirmed 2026-09-27. F4 held throughout this session. No secret values written to any file or transcript.
