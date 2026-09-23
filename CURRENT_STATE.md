# CURRENT_STATE — Lodgist frontend

Verified 2026-09-23 by Cursor on `/home/moronto/src/lodgist`.

## Checkout

| Item | Value |
|---|---|
| Owner | Cursor only |
| Branch | `agent/cursor-lodgist` |
| Starting HEAD | `4b20027509d96111d1bf16719a51b58a19420a40` |
| Remote | `origin` `SHADOWSPARK-TECHNOLOGIES/lodgist` |
| `origin/main` | same commit as starting HEAD |

This tree was restored from GitHub `main`. It is not evidence that remote `main` contains the unpublished local branch that existed before the Omarchy reinstall.

## Recovery gap (documented, not replayed)

Historical engineering notes in the read-only backend docs describe local branch `fix/property-ownership-and-session` and commits `c0eb7193` and `313d538c`. Those objects are not in this clone (`git cat-file` fails). The branch is not in local or `origin` refs. The backup bundle named in fleet checksums is not in the accessible backup. Root-file snapshot comparison is `~/agent-orchestrator/state/frontend-backup-comparison.json`: root files match the snapshot except `.gitignore`.

The snapshot `.gitignore` ignores `github.authkey` and `*.authkey`. Restored `.gitignore` does not. `github.authkey` is still tracked (41 bytes). Contents were not read. Untracking or rotating it is gated and was not done.

Missing historical work was not reconstructed from those notes. The property mutation gap below is visible in the current source.

## What is present

- Next app of record: `lodgist/` (Next 16.2.4, NextAuth 4, Vitest 4).
- `Property.ownerId` is a Prisma `Int`. Credentials `authorize` returns `id: String(user.id)`. `Role` includes `STUDIO_ADMIN` and does not include `ADMIN`.
- `POST /api/properties` sets `ownerId: parseInt(session.user.id)`.
- `PUT` and `DELETE` on `/api/properties/[id]` required a session, then skipped ownership. The commented comparison used `ownerId !== session.user.id` and `role !== 'ADMIN'`, which cannot match the current id types or role enum.
- `lodgist/app/layout.tsx` does not mount `SessionProvider`. `lodgist/hooks/use-role.ts` catches a missing provider and stays `isLoading: true`.

## This checkpoint

`canMutateProperty` allows the integer owner or `STUDIO_ADMIN`. `PUT` and `DELETE` return 403 when it is false. `ownerId` is still stripped from the update payload.

## Verification

- `npm ci --maxsockets=1` in `lodgist/` exit 0 (813 packages). Earlier `npm ci` failed `ENOTEMPTY` and was retried. `pnpm install --frozen-lockfile` failed: `lodgist/pnpm-lock.yaml` does not match `lodgist/package.json`. Install used `lodgist/package-lock.json`.
- `npx vitest run __tests__/canMutateProperty.test.ts`: 5 passed.
- `npm test`: 14 passed, 1 failed. Failure is pre-existing `calculateTruthIndex.test.ts` ("should persist the score to TruthIndexScore table"): create payload shape does not match the assertion. Not changed in this checkpoint.
- `npx tsc --noEmit --incremental false` exit 2. Errors are missing generated `@prisma/client` exports (`PrismaClient`, `Role`, and others) plus implicit `any` in existing files. `lib/authz.ts` and the property route are not in that error list. `packages/db` client was not generated.
- `npx eslint` on the three changed frontend files: 0 errors, 1 pre-existing warning (`ownerId: _` unused).

## Not done

- SessionProvider wrapper.
- Untrack or rotate `github.authkey`.
- Replay of the missing ownership/session branch.
- Writes under `backend/`.
