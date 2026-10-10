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

`packages/spatial-core` is a one-package pnpm workspace (`packages/spatial-core/pnpm-workspace.yaml`). It has no dependencies. The frontend does not depend on that directory: Railway's `lodgist` service only pulls `/frontend`, so the same package is vendored at `frontend/vendor/spatial-core` and installed with `file:./vendor/spatial-core` from `frontend/pnpm-lock.yaml`. A test fails if the vendor copy drifts from `packages/spatial-core`.

`backend/package-lock.json` stays. The API service install ends in `npm ci`, and the backend Actions job uses `npm ci`. Deleting it fails both.

The pnpm lockfiles stay. Railpack installs with `--frozen-lockfile`. Deleting one fails the service that installs that directory.

`frontend/package-lock.json` and `lodgist/package-lock.json` are not used by Railway. Actions installs those two directories with pnpm, so those npm lockfiles are not kept.

When a dependency changes, update the lockfile for that directory only:

- `frontend/`, `lodgist/`, `packages/db/`, `packages/ai-core/`, and the repo root: `pnpm install`, then commit the `pnpm-lock.yaml` only if `pnpm install --frozen-lockfile` still succeeds.
- `backend/`: `npm install`, then commit `package-lock.json` only if `npm ci` still succeeds.

Do not regenerate both lockfile types for one package. Railway Railpack selects pnpm 9 from `lockfileVersion: 9.0`. Actions also uses pnpm 9.15.9. A frozen install must pass on the lockfile you commit.

## Lockfile merge conflicts

`.gitattributes` marks every `pnpm-lock.yaml` and `package-lock.json` as `merge=binary`, so git reports a conflict on the whole file. It does not mix the two sides. Never resolve a lockfile with "accept both" or by editing hunks. That leaves duplicate keys or conflict markers, and the frozen install fails.

On a conflict in `<dir>/pnpm-lock.yaml` while merging `main` into your branch:

```bash
git checkout origin/main -- <dir>/pnpm-lock.yaml   # main's lockfile
(cd <dir> && pnpm install)                         # re-add your branch's dependency changes
(cd <dir> && pnpm install --frozen-lockfile)       # must pass before you commit
git add <dir>/pnpm-lock.yaml
```

For `backend/package-lock.json`, do the same with `npm install` and then `npm ci`.

Source files are different. If a conflict is in code, read both sides and keep one working version. "Accept both" on code usually leaves duplicate imports, two `export default` statements, or duplicated effect bodies.
