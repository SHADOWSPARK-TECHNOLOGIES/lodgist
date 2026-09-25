# Security rotation required

Values are not recorded here. Rotate anything that was committed, including history. Removing it from the current tree does not rotate it.

| Secret name | Path | Service | Reason | Status |
| --- | --- | --- | --- | --- |
| DATABASE_URL password (`lodgist_admin` on RDS) | `packages/db/.env.example` (historical) | AWS RDS `shadowspark-spine` | Real connection string was committed in the example file | USER ACTION REQUIRED |
| DATABASE_URL (`postgres` user on same RDS host) | `backend/.env.example`, `plans/backend-deployment-plan.md`, `plans/seed-env-runtime-audit.md`, `APPRUNNER_DEPLOY.md` (historical) | AWS RDS `shadowspark-spine` | Production host was committed with a password | USER ACTION REQUIRED |
| DIRECT_URL | same files as DATABASE_URL | AWS RDS | Same credential as DATABASE_URL in the example | USER ACTION REQUIRED |
| NEXTAUTH_SECRET | `plans/seed-env-runtime-audit.md` (historical) | NextAuth / lodgist-web | A generated secret was written into a plan | USER ACTION REQUIRED |
| WHATSAPP_VERIFY_TOKEN | `backend/.env.example`, `backend/src/routes/whatsapp.js`, `APPRUNNER_DEPLOY.md`, `backend/ngrok.yml`, `.github/copilot-instructions.md` (historical) | Meta WhatsApp | A fixed verify token was committed and used as a code fallback | USER ACTION REQUIRED |

Placeholders now in the tree use `postgresql://USER:PASSWORD@HOST:5432/DATABASE`, `replace-with-generated-secret`, and `replace-with-verify-token`.

No authenticated tool in this session can rotate RDS, NextAuth, or Meta credentials. Do not reuse the exposed values in Railway or Neon.
