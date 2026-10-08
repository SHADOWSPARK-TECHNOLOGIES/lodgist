# Lockfiles

GitHub Actions and Railway do not share one package manager. Each install below is frozen against the lockfile that command already uses.

| Install | Command | Lockfile |
|---|---|---|
| Actions job `frontend` | `pnpm install --frozen-lockfile` in `frontend/` | `frontend/pnpm-lock.yaml` |
| Actions job `ci`, Lodgist app | `pnpm install --frozen-lockfile` in `lodgist/` | `lodgist/pnpm-lock.yaml` |
| Actions job `ci`, database package | `pnpm install --frozen-lockfile` in `packages/db/` | `packages/db/pnpm-lock.yaml` |
| Actions job `backend` | `npm ci` in `backend/` | `backend/package-lock.json` |
| Railway service `lodgist` (root directory `/frontend`) | `pnpm install --frozen-lockfile` | `frontend/pnpm-lock.yaml` |
| Railway service `lodgist-api` | `pnpm install --frozen-lockfile` at the repo root, then the same in `packages/db`, then `npm ci --omit=dev` in `backend/` | `pnpm-lock.yaml`, `packages/db/pnpm-lock.yaml`, `backend/package-lock.json` |

`packages/ai-core/pnpm-lock.yaml` is the lockfile for that package. Actions and the two Railway services do not install it.

`backend/package-lock.json` stays. The API service install ends in `npm ci`, and the backend Actions job uses `npm ci`. Deleting it fails both.

The pnpm lockfiles stay. Railpack installs with `--frozen-lockfile`. Deleting one fails the service that installs that directory.

`frontend/package-lock.json` and `lodgist/package-lock.json` are not used by Railway. Actions installs those two directories with pnpm, so those npm lockfiles are not kept.

When a dependency changes, update the lockfile for that directory only:

- `frontend/`, `lodgist/`, `packages/db/`, `packages/ai-core/`, and the repo root: `pnpm install`, then commit the `pnpm-lock.yaml` only if `pnpm install --frozen-lockfile` still succeeds.
- `backend/`: `npm install`, then commit `package-lock.json` only if `npm ci` still succeeds.

Do not regenerate both lockfile types for one package. Railway Railpack selects pnpm 9 from `lockfileVersion: 9.0`. Actions uses pnpm 10. A frozen install must pass on the lockfile you commit.
