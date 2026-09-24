#!/usr/bin/env bash
# Per-boot startup for the Lodgist Cloud Agent environment.
# Starts PostgreSQL, ensures the dev/test databases exist and match the
# canonical Prisma schema (packages/db/prisma/schema.prisma), and seeds the
# dev database once. Idempotent and safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PG_VERSION="$(ls /usr/lib/postgresql/ 2>/dev/null | sort -V | tail -1 || true)"
DB_URL="postgresql://lodgist_user:lodgist_pass@127.0.0.1:5432/lodgist_db"
TEST_DB_URL="postgresql://lodgist_user:lodgist_pass@127.0.0.1:5432/lodgist_test"

echo "==> Starting PostgreSQL ${PG_VERSION}"
sudo pg_ctlcluster "${PG_VERSION}" main start 2>/dev/null || true

# Wait until the server accepts connections.
for i in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done
sudo -u postgres pg_isready || { echo "PostgreSQL did not become ready"; exit 1; }

echo "==> Ensuring role and databases exist"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='lodgist_user'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE lodgist_user WITH LOGIN PASSWORD 'lodgist_pass' SUPERUSER;"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='lodgist_db'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE lodgist_db OWNER lodgist_user;"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='lodgist_test'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE lodgist_test OWNER lodgist_user;"

echo "==> Syncing canonical schema to dev + test databases"
DATABASE_URL="$DB_URL" corepack pnpm --dir packages/db exec \
  prisma db push --config prisma.config.ts --accept-data-loss >/dev/null
corepack pnpm --dir packages/db exec \
  prisma db push --config prisma.config.ts --accept-data-loss --url "$TEST_DB_URL" >/dev/null

# Seed the dev database only when it has no users yet.
USER_COUNT="$(PGPASSWORD=lodgist_pass psql -tAqX "host=127.0.0.1 port=5432 user=lodgist_user dbname=lodgist_db sslmode=require" -c 'SELECT count(*) FROM "User";' 2>/dev/null || echo 0)"
if [ "${USER_COUNT:-0}" = "0" ]; then
  echo "==> Seeding dev database"
  DATABASE_URL="$DB_URL" corepack pnpm --dir packages/db exec tsx prisma/seed.ts
else
  echo "==> Dev database already seeded (${USER_COUNT} users) — skipping seed"
fi

echo "==> Database ready at ${DB_URL}"
