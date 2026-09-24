# CURRENT_STATE — Lodgist frontend

Verified 2026-09-24 by Cursor on `/home/moronto/src/lodgist`.

## Checkout

| Item | Value |
|---|---|
| Owner | Cursor only |
| Branch | `agent/cursor-lodgist` |
| Starting HEAD | `4b20027509d96111d1bf16719a51b58a19420a40` |
| Remote | `origin` `SHADOWSPARK-TECHNOLOGIES/lodgist` |

## Install

`pnpm@9.15.9` is pinned in the root `packageManager` field. CI installs the root, `packages/db`, and `lodgist` with `pnpm install --frozen-lockfile`.

- Root frozen install failed before this checkpoint because `pnpm-lock.yaml` still listed `@vercel/analytics` and `package.json` does not. The lock now matches `package.json`. Frozen install exit 0.
- `lodgist/pnpm-lock.yaml` was behind `lodgist/package.json`. It now matches, including `embedded-postgres`. Frozen install exit 0.
- `packages/db` frozen install exit 0.
- Lockfiles are v9, so CI now uses pnpm 9.15.9. pnpm 8 cannot install them.

## WhatsApp

Local conversation lives in `lodgist/lib/whatsapp/`. The webhook accepts Twilio form posts and JSON (`from`/`body`/`messageId`, or a Meta `entry` payload). It does not call the Graph API.

- `search` queries verified listings by address, city, or state.
- `book` creates a `PENDING` booking with `sourceChannel: whatsapp`, or returns the existing one for that phone and listing.
- `status` reads that booking. Missing ids are reported as missing.
- A repeated `messageId` / `MessageSid` is stored as `whatsapp:<id>` on `ProcessedWebhookEvent` and does not create a second booking.

## Verification

- `corepack pnpm install --frozen-lockfile --ignore-scripts` at repo root: exit 0.
- `corepack pnpm --dir lodgist install --frozen-lockfile --ignore-scripts`: exit 0.
- `npx vitest run`: 17 passed, 1 skipped, 1 failed. The failure is the pre-existing `calculateTruthIndex.test.ts` payload assertion. The skip is the Postgres test when `LODGIST_TEST_DATABASE_URL` is unset.
- With a throwaway embedded Postgres 18 on `127.0.0.1:54329` and `prisma db push` of `packages/db/prisma/schema.prisma`: `whatsappDb.integration.test.ts` 1 passed (search Lagos, one booking, duplicate event, status). That database was not a shared or production database. The server was stopped afterward.
- `npx eslint` on the WhatsApp files: exit 0.

## Not done

- `github.authkey` is still tracked (41 bytes). Contents were not read. Rotation was not performed.
- Meta Cloud API tokens are unset. Webhook verification returns 403 for `hub.mode=subscribe` until `WHATSAPP_VERIFY_TOKEN` is set. No Graph API send path was added.
- No deploy.
- `backend/` was not modified.
- SessionProvider is still absent.
- `npm test` remains red on the pre-existing TruthIndex assertion.
