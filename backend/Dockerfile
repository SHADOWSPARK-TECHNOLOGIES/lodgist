# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for local packages
COPY packages/db/package.json ./packages/db/
COPY backend/package.json ./backend/

# Copy source code preserving monorepo structure
COPY packages/db/src ./packages/db/src
COPY packages/db/prisma ./packages/db/prisma
COPY packages/db/prisma.config.ts ./packages/db/
COPY backend/src ./backend/src

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install backend dependencies
RUN cd backend && pnpm install --prod --frozen-lockfile 2>/dev/null; \
    # If pnpm lock missing, fall back to npm
    if [ $? -ne 0 ]; then \
      cd /app/backend && npm install --omit=dev; \
    fi

# Generate Prisma client
RUN cd /app/packages/db && npx prisma generate --config prisma.config.ts

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy everything preserving the monorepo structure
COPY --from=builder /app ./

# Expose the API port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start the server (from backend/src/index.js, ../../packages/db resolves to /app/packages/db)
CMD ["node", "backend/src/index.js"]
