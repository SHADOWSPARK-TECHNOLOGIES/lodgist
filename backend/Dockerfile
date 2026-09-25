# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Prisma needs DATABASE_URL at build time for prisma generate (even a dummy value works)
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL:-postgresql://dummy:dummy@localhost:5432/dummy}

WORKDIR /app

# Copy package files (including lockfiles for reproducible builds)
COPY backend/package.json ./backend/
COPY backend/package-lock.json* ./backend/
COPY packages/db/package.json ./packages/db/

# Copy source code preserving monorepo structure
COPY packages/db/src ./packages/db/src
COPY packages/db/prisma ./packages/db/prisma
COPY packages/db/prisma.config.ts ./packages/db/
COPY backend/src ./backend/src

# Install backend dependencies (production only, with lockfile for reproducibility)
RUN cd backend && npm install --omit=dev --production

# Install packages/db dependencies.
# @prisma/client, @prisma/adapter-pg, pg, bcryptjs are needed at runtime.
# dotenv is needed for prisma.config.ts, prisma (dev) for generate.
RUN cd /app/packages/db && \
    npm install --legacy-peer-deps --no-package-lock \
    @prisma/client@^7.8.0 \
    @prisma/adapter-pg@^7.8.0 \
    pg@^8.20.0 \
    bcryptjs@^3.0.3 \
    dotenv@^17.4.2 \
    prisma@^7.8.0

# Generate Prisma client
RUN cd /app/packages/db && npx prisma generate --config prisma.config.ts

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Install wget for health checks (Alpine doesn't ship it by default)
RUN apk add --no-cache wget

# Copy everything preserving the monorepo structure
COPY --from=builder /app ./

# Switch to non-root user for security
USER node

# PORT is injected at runtime (Railway). Default matches backend/src/index.js.
# $$ so Docker does not expand PORT at build time.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:$${PORT:-4000}/api/health" || exit 1

# Start the server
CMD ["node", "backend/src/index.js"]
