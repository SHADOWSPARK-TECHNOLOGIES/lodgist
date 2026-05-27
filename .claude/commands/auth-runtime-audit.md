# /auth-runtime-audit

Audit the auth configuration for runtime correctness before deploy.

## Steps

1. Find auth config: `find lodgist/app/api/auth -name "*.ts" | head -5`
2. Check NextAuth config: `cat lodgist/app/api/auth/\\[...nextauth\\]/route.ts`
3. Check middleware: `cat lodgist/middleware.ts 2>/dev/null || cat lodgist/proxy.ts 2>/dev/null`
4. Check env vars: `grep -E "NEXTAUTH|GITHUB|GOOGLE|JWT" lodgist/.env 2>/dev/null | cut -d= -f1`
5. Check Vercel env: `vercel env ls | grep -E "NEXTAUTH|OAUTH"`

## Audit Checklist

**NEXTAUTH_SECRET**
- [ ] Set in all Vercel environments (production, preview, development)
- [ ] Minimum 32 chars — `openssl rand -base64 32` to generate
- [ ] Not hardcoded anywhere in codebase: `grep -r "NEXTAUTH_SECRET=" lodgist/app --include="*.ts"`

**NEXTAUTH_URL**
- [ ] Set to `https://lodgist.vercel.app` in production
- [ ] Set to `http://localhost:3000` in development
- [ ] Not missing — causes callback failures

**OAuth Providers (GitHub/Google)**
- [ ] `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` set
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set
- [ ] Callback URLs registered in each provider dashboard:
  - GitHub: `https://lodgist.vercel.app/api/auth/callback/github`
  - Google: `https://lodgist.vercel.app/api/auth/callback/google`

**Session & Role**
- [ ] `session.user.id` available (check Prisma adapter wiring)
- [ ] `session.user.role` available — needed for admin route protection
- [ ] JWT callback maps `user.role` to token

**Middleware protection**
- [ ] `/dashboard/*` routes require authentication
- [ ] `/api/admin/*` routes require ADMIN role
- [ ] Public routes not accidentally protected: `/`, `/search`, `/listings/[id]`, `/students`

## Output Format

```
## Auth Audit Result

### Env Vars
- NEXTAUTH_SECRET: SET / MISSING / TOO SHORT
- NEXTAUTH_URL: [value] — CORRECT / WRONG
- GitHub OAuth: CONFIGURED / MISSING
- Google OAuth: CONFIGURED / MISSING

### Callback URLs (require manual dashboard update)
- GitHub callback: [URL] — REGISTERED / NOT REGISTERED
- Google callback: [URL] — REGISTERED / NOT REGISTERED

### Session Shape
- user.id: AVAILABLE / MISSING
- user.role: AVAILABLE / MISSING

### Route Protection
- /dashboard: PROTECTED / UNPROTECTED
- /api/admin: PROTECTED / UNPROTECTED

### Critical Fixes
1. [fix]
```
