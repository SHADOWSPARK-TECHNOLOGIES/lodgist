# /release-readiness

Full pre-release audit before pushing to production.

## Run All Checks

```bash
# 1. TypeScript
cd lodgist && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l

# 2. Build
cd lodgist && npx next build 2>&1 | tail -30

# 3. Git status
git status --short
git log origin/main..HEAD --oneline

# 4. Env vars on Vercel
vercel env ls

# 5. Deploy status
vercel ls | head -5
```

## Checklist

**Code**
- [ ] TypeScript: 0 errors
- [ ] Build: passes without errors
- [ ] No `console.log` in production paths (grep check)
- [ ] No hardcoded secrets or credentials

**Auth**
- [ ] NEXTAUTH_SECRET set on Vercel
- [ ] NEXTAUTH_URL = https://lodgist.vercel.app
- [ ] OAuth callback URLs updated in GitHub + Google dashboards

**Payments**
- [ ] PAYSTACK_SECRET_KEY set on Vercel
- [ ] Webhook signature verification implemented
- [ ] Idempotency logic in place

**Database**
- [ ] All migrations applied (prisma migrate status)
- [ ] Seed data present (at least 6 listings)
- [ ] TrustComponents initialized for all listings

**Security**
- [ ] No secrets in .env committed to git
- [ ] Admin routes protected by role check
- [ ] Public APIs return sanitized responses (no fraudSignals, documentUrls, etc.)

**Performance**
- [ ] Homepage is static (○) in build output
- [ ] Search page is static (○)
- [ ] Dynamic routes (ƒ) are only API routes and listing detail

## Output Format

```
## Release Readiness Report — [date]

### Code Quality
- TypeScript errors: [N]
- Build: PASS / FAIL
- Console.log in prod: FOUND / CLEAN

### Auth
[checklist items]

### Payments
[checklist items]

### Database
[checklist items]

### Security
[checklist items]

### LAUNCH READINESS SCORE: [N]/10

### Remaining Blockers
1. [blocker]
```
