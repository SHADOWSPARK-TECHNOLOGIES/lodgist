// ─── Canonical PrismaClient Singleton ─────────────────────────────────────────
// This file delegates to the shared PrismaClient from packages/db/src/client.js,
// which is the single source of truth for database connectivity across the entire
// monorepo (handles IPv4 resolution for Neon, pooled connections, SSL/SNI, etc.).
//
// The globalThis guard prevents multiple instances during Next.js hot-module
// reloading in development.
// ───────────────────────────────────────────────────────────────────────────────

import basePrisma from "../../packages/db/src/client.js";
import type { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  (globalForPrisma.prisma ?? basePrisma) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
