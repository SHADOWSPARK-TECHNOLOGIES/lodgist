# Railway environment contract

No values. Set these in the Railway service variables, not in git.

## lodgist-web

| Name | Class | Why |
| --- | --- | --- |
| `DATABASE_URL` | REQUIRED | `packages/db/src/client.js` refuses to start without it. Use the Neon pooled URL. |
| `DIRECT_URL` | REQUIRED | `packages/db/prisma.config.ts` uses it for `migrate deploy` in the web pre-deploy command. Use the Neon direct URL. |
| `NEXTAUTH_SECRET` | REQUIRED | NextAuth JWT sessions (`lodgist/auth.ts`). Generate a new value. Do not reuse the secret that was committed in `plans/seed-env-runtime-audit.md`. |
| `NEXTAUTH_URL` | REQUIRED | Public web origin, `https://<lodgist-web-domain>`. An empty value crashes URL construction. |
| `NODE_ENV` | REQUIRED | `production`. Railway usually sets this. |
| `GITHUB_CLIENT_ID` | CONDITIONAL | GitHub OAuth. Omit both GitHub vars to keep credentials login only. |
| `GITHUB_CLIENT_SECRET` | CONDITIONAL | Pair with `GITHUB_CLIENT_ID`. |
| `GOOGLE_CLIENT_ID` | CONDITIONAL | Google OAuth. Omit both Google vars to keep credentials login only. |
| `GOOGLE_CLIENT_SECRET` | CONDITIONAL | Pair with `GOOGLE_CLIENT_ID`. |
| `NEXT_PUBLIC_GITHUB_AUTH_ENABLED` | CONDITIONAL | Login page shows GitHub only when this is `true`. |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | CONDITIONAL | Login page shows Google only when this is `true`. |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | OPTIONAL | Support handoff on payment routes. Defaults to a placeholder number. |
| `REDIS_URL` | UNUSED | `lodgist/lib/redis.ts` reads it, and nothing imports that module. |

## lodgist-api

Production boot (`backend/src/index.js`) exits if any required row is missing or still points at localhost.

| Name | Class | Why |
| --- | --- | --- |
| `DATABASE_URL` | REQUIRED | Shared Prisma client. Same Neon pooled URL as web. |
| `JWT_SECRET` | REQUIRED | Production guard and `jsonwebtoken`. |
| `CORS_ORIGIN` | REQUIRED | Web origin. Empty production config allows no browser origins. |
| `NODE_ENV` | REQUIRED | `production` enables the boot guards and webhook signature checks. |
| `WEBAUTHN_RP_ID` | REQUIRED | Web hostname only. `localhost` fails the boot guard. |
| `WEBAUTHN_ORIGIN` | REQUIRED | Web origin. A localhost value fails the boot guard. |
| `WEBAUTHN_RP_NAME` | OPTIONAL | Defaults to `Lodgist`. |
| `WEBAUTHN_ENABLED` | OPTIONAL | Defaults on unless set to `false`. |
| `HOST` | OPTIONAL | Defaults to `0.0.0.0`. |
| `PORT` | OPTIONAL | Railway sets it. Code default is 4000. |
| `JWT_EXPIRES_IN` | OPTIONAL | Default `24h`. |
| `JWT_REFRESH_EXPIRES_IN` | OPTIONAL | Default `30d`. |
| `WHATSAPP_APP_SECRET` | CONDITIONAL | Required for production `POST /api/whatsapp/webhook`. Missing secret rejects the signature. |
| `WHATSAPP_VERIFY_TOKEN` | CONDITIONAL | Required for `GET /api/whatsapp/webhook`. No code fallback. |
| `WHATSAPP_API_TOKEN` | CONDITIONAL | Outbound Cloud API sends. |
| `WHATSAPP_PHONE_NUMBER_ID` | CONDITIONAL | Outbound Cloud API sends. |
| `WHATSAPP_PUBLIC_URL` | CONDITIONAL | Link base in outbound replies. Use the web origin. Default in code is `https://lodgist.ng`. |
| `PAYSTACK_SECRET_KEY` | CONDITIONAL | Webhook HMAC and payment calls. Webhook returns 401 when it is unset. Do not log it. |
| `PAYSTACK_PUBLIC_KEY` | UNUSED | Present in `backend/.env.example` only. No runtime read. |
| `OPENAI_API_KEY` | CONDITIONAL | Listing scam detection. That route fails closed when unset. |
| `GEMINI_API_KEY` | UNUSED | No `process.env.GEMINI_API_KEY` read under `backend/src`. |
| `GCP_PROJECT_ID` | OPTIONAL | Gemini/Vertex client. Defaults to a project id in source. |
| `GCP_PROJECT_LOCATION` | OPTIONAL | Defaults to `us-central1`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | CONDITIONAL | Vertex file path. Do not commit the JSON. |

`DIRECT_URL` is not read by the API process. Keep it on `lodgist-web` only, unless you later move migration ownership.
