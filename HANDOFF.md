# HANDOFF — Lodgist frontend

Cursor owns `/home/moronto/src/lodgist` on `agent/cursor-lodgist`. Do not push. Do not write `backend/` or the separate `lodgist-backend` checkout.

## Done

Property `PUT` and `DELETE` now call `canMutateProperty` (`lodgist/lib/authz.ts`). Owner match uses the integer id. Admin match is `STUDIO_ADMIN` only. Tests: `lodgist/__tests__/canMutateProperty.test.ts` (5 passed).

## Leave alone

- Uncommitted fleet files: `AGENTS.md`, `.agent-context.md`, `.cursor/`, `ORCHESTRATOR_START.md`.
- Tracked `github.authkey` (41 bytes, not ignored). Do not print it. Removal and rotation are gated.
- Missing objects `c0eb7193` and `313d538c` and branch `fix/property-ownership-and-session`. Do not invent that diff.

## Next

Wrap the Next app in NextAuth `SessionProvider` so `useRole` / `withRole` leave the loading state. Confirm the v4 client API from the installed `next-auth` package before editing `lodgist/app/layout.tsx`.

## Blockers

- `BLOCKED_BY_RECOVERY`: unpublished frontend branch and bundle are not in this clone.
- `BLOCKED_BY_GATE`: do not untrack or rotate `github.authkey` without an explicit gate.
- `tsc` stays red until `packages/db` Prisma client is generated. That was not run here.
