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

- A guest message such as "I need a place in Lagos from 2026-10-01 to 2026-10-05" is parsed for a place and two `YYYY-MM-DD` dates. `search` queries verified listings and, when dates are present, hides listings with an overlapping `PENDING`, `PENDING_VERIFICATION`, or `CONFIRMED` booking.
- Numbered replies book that option on the existing `Booking` model with `sourceChannel: whatsapp` and those dates. `book [id]` and `status` still work.
- The admin recent-bookings table shows `sourceChannel`.
- A repeated `messageId` / `MessageSid` is stored as `whatsapp:<id>` on `ProcessedWebhookEvent` and does not create a second booking.

## Verification

- `corepack pnpm install --frozen-lockfile --ignore-scripts` at repo root: exit 0.
- `corepack pnpm --dir lodgist install --frozen-lockfile --ignore-scripts`: exit 0.
- Status lookup returns a booking only when `tenant.whatsappId` matches the sender.
- A message id is claimed inside `prisma.$transaction`. A thrown booking rolls the claim back. The webhook returns HTTP 500 on that failure so the provider can retry.
- `npx vitest run` in `lodgist/` without `LODGIST_TEST_DATABASE_URL`: 32 passed, 4 skipped, exit 0.
- Meta and Twilio signatures are checked in `verifyWebhook.ts`. Unsigned local JSON is rejected when `NODE_ENV=production`. Missing or invalid signatures return 403.
- With throwaway Postgres on `127.0.0.1:54329`: `whatsappDb.integration.test.ts` 4 passed, including one overlapping winner under `booking_no_overlap` and a draft restored after the session map was dropped. Server stopped afterward. The migration SQL was not applied to production.
- TruthIndex persist assertion expected `breakdown`. The implementation and schema use `metadata`. The assertion was updated. It was stale since `bd9e39c2`, identical on `origin/main`.
- `github.authkey` removed from the index only. The local file was kept. It was not read. It is still in Git history. Rotation has not happened.
- With a throwaway embedded Postgres 18 on `127.0.0.1:54329` and `prisma db push` of `packages/db/prisma/schema.prisma`: `whatsappDb.integration.test.ts` 1 passed (search Lagos, one booking, duplicate event, status). That database was not a shared or production database. The server was stopped afterward.
- `npx eslint` on the WhatsApp files: exit 0.

## Not done

- `github.authkey` is not in `HEAD`. It remains in history from `5fcfea4a` and on `origin/main`. Contents were not read. Rotation was not performed. See `docs/GITHUB_AUTHKEY_REMEDIATION.md`.
- Meta Cloud API tokens are unset. Webhook verification returns 403 for `hub.mode=subscribe` until `WHATSAPP_VERIFY_TOKEN` is set. No Graph API send path was added.
- No deploy.
- `backend/` was not modified.
- SessionProvider is still absent.
- `npm test` remains red on the pre-existing TruthIndex assertion.
