# Railway deployment

Verified from this repository. Domains are assigned by Railway after the service exists. Do not invent them.

## Architecture

| Path | Role |
| --- | --- |
| `lodgist/` | Next.js web app (`lodgist-web`) |
| `backend/` | Express API (`lodgist-api`) |
| `packages/db/` | Canonical Prisma schema, migrations, and shared client |

`lodgist/lib/prisma.ts` imports `packages/db/src/client.js`. `backend/src/index.js` requires the same client. Both services must build from the repository root so `packages/db` stays on the filesystem.

Schema: `packages/db/prisma/schema.prisma`. Config: `packages/db/prisma.config.ts`. `DATABASE_URL` is the runtime connection. `DIRECT_URL` is the direct connection Prisma uses for migrations.

## lodgist-web

| Setting | Value |
| --- | --- |
| Source repo | `SHADOWSPARK-TECHNOLOGIES/lodgist` |
| Branch | `main` (after this change is merged) |
| Root directory | `/` |
| Config file | `/railway.web.json` |
| Builder | RAILPACK |
| Build | `corepack enable && cd packages/db && pnpm install --frozen-lockfile && pnpm exec prisma generate --config prisma.config.ts && cd ../../lodgist && npm ci && npm run build` |
| Pre-deploy | `cd packages/db && pnpm exec prisma migrate deploy --config prisma.config.ts` |
| Start | `HOSTNAME=0.0.0.0 sh -c 'cd lodgist && npx next start --port "$PORT"'` |
| Health | `GET /api/health` |
| Migration owner | This service only. Do not also run migrations from `lodgist-api`. |

Railway UI: service **lodgist-web** → Settings → Root Directory `/` → Config-as-code path `/railway.web.json`.

`next start` reads `$PORT`. `HOSTNAME=0.0.0.0` binds all interfaces. Do not hard-code a port.

## lodgist-api

| Setting | Value |
| --- | --- |
| Source repo | `SHADOWSPARK-TECHNOLOGIES/lodgist` |
| Branch | `main` (after this change is merged) |
| Root directory | `/` |
| Config file | `/railway.api.json` |
| Builder | DOCKERFILE |
| Dockerfile | `backend/Dockerfile` |
| Start | image `CMD`: `node backend/src/index.js` |
| Health | `GET /api/health` |

The process listens on `process.env.PORT` (default 4000) and `HOST` (default `0.0.0.0`). The image health check uses `$PORT`, not 8080.

Railway UI: service **lodgist-api** → Settings → Root Directory `/` → Config-as-code path `/railway.api.json` → builder Dockerfile → Dockerfile path `backend/Dockerfile`.

One root `railway.json` cannot describe both services. Railway reads a single config file per service, so each service must point at its own file.

## Database

Production command, and only this command:

```bash
cd packages/db && pnpm exec prisma migrate deploy --config prisma.config.ts
```

Do not run `prisma migrate dev` or `prisma db push` against production.

Migrations on `origin/main` at the time of this branch (`20260517000000` through `20260519000000`) contain no `DROP`, `TRUNCATE`, or `DELETE`. `20260924100000_booking_no_overlap` is not on this branch.

Neon: set `DATABASE_URL` to the pooled URL and `DIRECT_URL` to the direct URL. Store both only in Railway variables.

## Domains

After Railway creates domains:

| Use | Value |
| --- | --- |
| Web | `https://<lodgist-web-domain>` |
| API | `https://<lodgist-api-domain>` |
| `NEXTAUTH_URL` | web origin |
| `CORS_ORIGIN` | web origin |
| `WEBAUTHN_RP_ID` | web hostname only |
| `WEBAUTHN_ORIGIN` | web origin |
| Web health | `https://<lodgist-web-domain>/api/health` |
| API health | `https://<lodgist-api-domain>/api/health` |
| Meta webhook | `https://<lodgist-api-domain>/api/whatsapp/webhook` |

`WHATSAPP_PUBLIC_URL` is the link base in outbound WhatsApp replies (`backend/src/routes/whatsapp.js`). Point it at the web origin. The webhook itself is the API path above.

OAuth callback URLs, once the web domain exists:

- Google: `https://<lodgist-web-domain>/api/auth/callback/google`
- GitHub: `https://<lodgist-web-domain>/api/auth/callback/github`

Variable names and classes: `docs/RAILWAY_ENVIRONMENT.md`.
