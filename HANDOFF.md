# HANDOFF — Lodgist frontend

Cursor owns `/home/moronto/src/lodgist` on `agent/cursor-lodgist`. Do not push. Do not write `backend/`.

## Done

Reproducible pnpm 9.15.9 installs for the root, `packages/db`, and `lodgist`. WhatsApp guest text can search by place and dates, pick a numbered option, and create the existing `Booking` with `sourceChannel: whatsapp`. Admin recent bookings show the channel. Postgres integration test still covers the command path when `LODGIST_TEST_DATABASE_URL` is set.

## Leave alone

- Local-only fleet files: `.agent-context.md`, `ORCHESTRATOR_START.md`, `.cursor/CONTEXT_INDEX.md`, `.cursor/rules/99-agent-orchestrator.mdc`. They are gitignored.
- `github.authkey` on disk and in Git history. Do not print it. Rotation is still gated.
- `backend/` and the separate `lodgist-backend` checkout.
- Production application of `20260924100000_booking_no_overlap`.

## Next

External only. Follow `docs/WHATSAPP_PRODUCTION_READINESS.md`: rotate the credential that was in `github.authkey`, set Meta env, deploy, verify the webhook, smoke-test. Do not invent tokens.

## Blockers

- `BLOCKED_BY_GATE`: credential rotation, Meta app secrets, and deploy were not done.
- `BLOCKED_BY_RECOVERY`: unpublished `fix/property-ownership-and-session` is still absent.
- Default `npx vitest run` skips the Postgres test unless `LODGIST_TEST_DATABASE_URL` is set.
