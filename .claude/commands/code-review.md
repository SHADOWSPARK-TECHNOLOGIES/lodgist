# /code-review

Review staged or recent changes before committing or deploying.

## Steps

1. `git diff --stat HEAD` — files changed
2. `git diff HEAD` — full diff
3. `cd lodgist && npx tsc --noEmit 2>&1 | grep "error TS"` — type errors
4. Check each changed file against the checklist below

## Review Checklist

**TypeScript**
- [ ] No `any` types introduced
- [ ] No `as unknown as X` casts
- [ ] All function params and returns typed

**Security**
- [ ] No new hardcoded credentials or URLs
- [ ] New API routes have auth checks where needed
- [ ] No new raw SQL without parameterization

**Prisma**
- [ ] No schema field renames (breaking)
- [ ] New fields are additive (optional or with defaults)
- [ ] No new `prisma.$queryRaw` without review

**React / Next.js**
- [ ] Client components marked `"use client"` where needed
- [ ] `useSearchParams()` wrapped in `<Suspense>`
- [ ] No `useState` / `useEffect` in Server Components
- [ ] Images use `<img>` with explicit dimensions or `next/image`

**Style**
- [ ] Mobile-first — every new component tested at 375px mentally
- [ ] Brand colors used correctly: navy #0B1B2B, orange #FF6F3C, teal #1ABC9C
- [ ] No new icon libraries imported

**Architecture**
- [ ] Trust state not computed on frontend (always from API)
- [ ] `truthIndex` on Listing only set via `syncTruthIndex()`
- [ ] Admin actions logged to AdminAction table

## Output Format

```
## Code Review

### Changed Files
[list]

### TypeScript
- Errors: [N]

### Issues Found
- [file:line] [CRITICAL/WARN/INFO] [description]

### Approved / Changes Requested
```
