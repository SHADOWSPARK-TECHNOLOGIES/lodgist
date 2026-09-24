#!/usr/bin/env bash
# Cloud Agent environment bootstrap for the Lodgist monorepo.
# Idempotent: installs dependencies, generates the Prisma client, and writes
# local dev .env files. Runs after the repository is checked out.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DB_URL="postgresql://lodgist_user:lodgist_pass@127.0.0.1:5432/lodgist_db"

echo "==> [1/4] Installing dependencies"
corepack pnpm install --frozen-lockfile
corepack pnpm --dir packages/db install --frozen-lockfile
corepack pnpm --dir lodgist install --frozen-lockfile
corepack pnpm --dir packages/ai-core install --frozen-lockfile --config.confirmModulesPurge=false
corepack pnpm --dir frontend install --frozen-lockfile --config.confirmModulesPurge=false
( cd backend && npm ci )

echo "==> [2/4] Generating Prisma client (shared schema in packages/db)"
DATABASE_URL="$DB_URL" corepack pnpm --dir packages/db exec prisma generate --config prisma.config.ts

echo "==> [3/4] Writing local dev .env files (only when missing)"
write_env() {
  local file="$1"; shift
  if [ -f "$file" ]; then
    echo "    kept existing $file"
    return
  fi
  printf '%s\n' "$@" > "$file"
  echo "    wrote $file"
}

NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -hex 32)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

write_env "lodgist/.env" \
  "DATABASE_URL=\"$DB_URL\"" \
  "DIRECT_URL=\"$DB_URL\"" \
  "NEXTAUTH_URL=\"http://localhost:3000\"" \
  "NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"" \
  "NODE_ENV=\"development\""

write_env "packages/db/.env" \
  "DATABASE_URL=\"$DB_URL\"" \
  "DIRECT_URL=\"$DB_URL\""

write_env "backend/.env" \
  "DATABASE_URL=\"$DB_URL\"" \
  "PORT=4000" \
  "HOST=0.0.0.0" \
  "NODE_ENV=development" \
  "JWT_SECRET=\"$JWT_SECRET\"" \
  "CORS_ORIGIN=\"http://localhost:3000,http://localhost:3001\"" \
  "WEBAUTHN_RP_ID=\"localhost\"" \
  "WEBAUTHN_ORIGIN=\"http://localhost:3000\""

write_env "packages/ai-core/.env" \
  "DATABASE_URL=\"$DB_URL\"" \
  "PORT=4001" \
  "NODE_ENV=development"

echo "==> [4/4] Install complete"
