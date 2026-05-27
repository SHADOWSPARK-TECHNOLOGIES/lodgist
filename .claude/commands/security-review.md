# /security-review

Run a targeted security audit on Lodgist API routes and auth.

## Automated Checks

```bash
# Check for hardcoded secrets
grep -rn "sk_live\|sk_test\|Bearer \|password.*=.*['\"]" lodgist/app lodgist/lib --include="*.ts" | grep -v node_modules | grep -v ".env"

# Check for SQL injection risk (raw queries)
grep -rn "prisma.\$queryRaw\|prisma.\$executeRaw" lodgist/app lodgist/lib --include="*.ts" | grep -v node_modules

# Check for missing auth guards on API routes
grep -rn "export async function" lodgist/app/api --include="route.ts" -l

# Check public routes returning sensitive fields
grep -rn "documentUrl\|fraudSignal\|reviewNote\|passwordHash" lodgist/app/api --include="route.ts"
```

## Manual Review Points

**Input validation**
- All `req.json()` bodies validated with Zod or manual checks
- File uploads check MIME type server-side, not just extension
- IDs parsed and validated (parseInt, isNaN checks)

**Auth boundaries**
- Every `/api/admin/*` route checks `session.user.role === 'ADMIN'`  
- Every `/api/listings/[id]/verify` POST checks `session.user.id`
- Payment initiation requires authenticated session

**Output sanitization**
- Trust API GET does not return: documentUrls, fraudSignals, reviewNote, submittedById
- User API does not return: passwordHash, idNumber
- Public listing API does not return: adminNotes, internalFlags

**Rate limiting**
- Trust API: should be rate limited (no limit = abuse vector for scoring)
- Auth endpoints: NextAuth handles, but verify no custom auth endpoints lack limits
- Payment initiation: idempotency key prevents double-charge

## Output Format

```
## Security Review

### Hardcoded Secrets
- CLEAN / [file:line with issue]

### Raw SQL
- NONE / [file:line with issue]

### API Auth Gaps
- [route]: PROTECTED / UNPROTECTED

### Sensitive Data Leaks
- [route]: CLEAN / LEAKS [field]

### Critical Issues (fix before deploy)
1. [issue]

### Recommendations
1. [improvement]
```
