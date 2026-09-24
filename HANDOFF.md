# HANDOFF — Lodgist frontend

Cursor owns `/home/moronto/src/lodgist` on `agent/cursor-lodgist`. Do not push. Do not write `backend/`.

## Done

Reproducible pnpm 9.15.9 installs for the root, `packages/db`, and `lodgist`. Local WhatsApp search/book/status in `lodgist/lib/whatsapp/`, with `ProcessedWebhookEvent` duplicate protection. Postgres integration test passed against a throwaway local database.

## Leave alone

- Uncommitted fleet files: `AGENTS.md`, `.agent-context.md`, `.cursor/`, `ORCHESTRATOR_START.md`.
- Tracked `github.authkey` (41 bytes, not read). Do not print it. Rotation is still gated.
- `backend/` and the separate `lodgist-backend` checkout.
- Pre-existing `calculateTruthIndex.test.ts` failure.

## Next

Set `WHATSAPP_VERIFY_TOKEN` locally when a real Meta app exists, then confirm `GET /api/whatsapp/webhook` echoes `hub.challenge`. Do not deploy and do not invent tokens. Outbound Cloud API sends stay unwired until a phone number id and token are provided.

## Blockers

- `BLOCKED_BY_GATE`: credential rotation, Meta app secrets, and deploy were not done.
- `BLOCKED_BY_RECOVERY`: unpublished `fix/property-ownership-and-session` is still absent.
- Default `npx vitest run` skips the Postgres test unless `LODGIST_TEST_DATABASE_URL` is set.
