// ─── Mock Prisma Client for Vitest ───────────────────────────────────────────
// Provides a fully mocked PrismaClient with chainable methods.

import { vi } from "vitest";

type DeepMockProxy<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? ReturnType<typeof vi.fn<(...args: A) => R>>
    : DeepMockProxy<T[K]>;
};

function createMockModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  };
}

export const prisma = {
  property: createMockModel(),
  listing: createMockModel(),
  booking: createMockModel(),
  user: createMockModel(),
  role: createMockModel(),
  account: createMockModel(),
  session: createMockModel(),
  verificationToken: createMockModel(),
  truthIndexScore: createMockModel(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $on: vi.fn(),
  $use: vi.fn(),
  $transaction: vi.fn(),
};

export default prisma;
