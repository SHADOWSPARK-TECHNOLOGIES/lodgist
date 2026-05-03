# GEMINI.md

Project: Lodgist
Stack: Next.js, TypeScript, Prisma, NextAuth, Zustand
Goal: Build trust-first property profiles using Lodgist Truth Index

Rules:
- Use TypeScript everywhere.
- Do not break existing auth or RBAC flows.
- Preserve mobile-first UI patterns.
- Brand colors:
  - Deep Navy: #0B1B2B
  - Vibrant Orange: #FF6F3C
- Truth Index formula:
  - 0.4 * activity + 0.3 * verification + 0.3 * rating
- Create or update:
  - prisma/schema.prisma
  - lib/truth-index.ts
  - stores/useLodgistProfileStore.ts
  - types/profile.ts
  - app or src components that render verified badges
- Add comments only where necessary.
- Prefer small, reviewable commits.
- After edits:
  - run prisma format
  - run prisma generate
  - run typecheck
  - run tests if present
