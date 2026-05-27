# Phase 4 — Admin Dashboard
# Paste this entire block into Claude CLI

Read CLAUDE.md before proceeding. All rules there apply here.
Phases 1, 2, and 3 must be complete before this phase.

## Pre-flight
1. Detect admin auth pattern: is there a role field on User? An isAdmin boolean? 
   A separate admin session? Check schema.prisma and auth config.
2. Check for existing admin routes: find app/admin pages/admin -type f 2>/dev/null
3. Check for existing middleware protecting admin routes: cat middleware.ts 2>/dev/null
Report. Then proceed.

---

## Task 1 — Admin Auth Middleware

If no admin route protection exists:
Create/update middleware.ts to protect /admin/* routes.

Pattern (adapt to detected auth):
```ts
// If NextAuth:
const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
if (!session || session.role !== 'ADMIN') {
  return NextResponse.redirect(new URL('/login', req.url))
}

// If Clerk:
const { userId } = auth()
// Check user metadata for admin role
```

Do not build the admin layout if the route is not protected. Flag as BLOCKER if
you cannot detect the auth pattern.

---

## Task 2 — Admin Verifications Queue

Create: app/(admin)/admin/verifications/page.tsx

Page: List all VerificationRequests ordered by createdAt desc.
Filter tabs: All | Pending | In Review | Approved | Rejected

Table columns:
| Column | Source |
|---|---|
| Listing | listing.title + listing.address (truncated) |
| Submitted By | submittedBy.name or email |
| Documents | documentUrls.length + "files" |
| Submitted | createdAt (relative: "2 days ago") |
| Status | VerificationStatus badge |
| Action | "Review" button → /admin/verifications/[requestId] |

Server component (App Router) or getServerSideProps (Pages Router).
Fetch with Prisma directly — this is admin-only, no public API needed.

Pagination: 20 per page. Simple prev/next.

---

## Task 3 — Admin Verification Detail

Create: app/(admin)/admin/verifications/[requestId]/page.tsx

Layout:
1. Listing info header (title, address, current riskState badge)
2. Submitted by: name, email, submission date
3. Documents section:
   - List each documentUrl as a link (target="_blank")
   - Label: "Document 1", "Document 2" etc.
4. Notes from submitter (if any)
5. Trust Component Checklist (editable):
   - Show all 6 TrustComponents for this listing
   - Toggle each: passed true/false
   - Notes field per component (optional)
   - "Save Component Updates" button
6. Review Decision:
   - Dropdown: Approve | Reject | Request More Info
   - Review note textarea (required for Reject and Request More Info)
   - "Submit Decision" button (orange)

On "Save Component Updates":
- PATCH /api/admin/listings/[listingId]/trust-components
- Update each TrustComponent's passed and notes
- Call syncTruthIndex after save
- Show updated truthIndex

On "Submit Decision":
- POST /api/admin/verifications/[requestId]/review
- Updates VerificationRequest status
- If APPROVED: set listing riskState to VERIFIED, syncTruthIndex
- If REJECTED: set listing riskState back to UNVERIFIED
- If NEEDS_MORE_INFO: leave riskState as UNDER_REVIEW
- Always write AdminAction log entry

---

## Task 4 — Admin Listings Overview

Create: app/(admin)/admin/listings/page.tsx

Table of all listings with:
| Column | |
|---|---|
| Title | |
| Owner | |
| RiskState | RiskStateBadge |
| TruthIndex | TruthIndexMeter size="sm" |
| FraudSignals | count of OPEN signals |
| Action | "Manage" → /admin/listings/[id] |

Filter by riskState. Sort by truthIndex asc (worst first by default).

---

## Task 5 — Admin API Routes

### PATCH /api/admin/listings/[listingId]/trust-components
- Auth: admin only
- Body: { components: { componentKey: string, passed: boolean, notes?: string }[] }
- Update each TrustComponent via upsert
- Call syncTruthIndex
- Write AdminAction: type RISK_STATE_OVERRIDE (or add COMPONENT_UPDATE to enum — flag first)
- Return: { truthIndex: number, components: [...] }

### POST /api/admin/verifications/[requestId]/review  
- Auth: admin only
- Body: { decision: 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_INFO', reviewNote: string }
- Update VerificationRequest: status, reviewedById, reviewedAt, reviewNote
- Update Listing riskState based on decision (see Task 3 logic above)
- If APPROVED: syncTruthIndex
- Write AdminAction
- Return: { success: true, newRiskState: string }

### POST /api/admin/listings/[listingId]/risk-state
- Auth: admin only
- Body: { riskState: RiskState, reason: string }
- Direct override — used for FLAGGED and SUSPENDED
- Write AdminAction: type RISK_STATE_OVERRIDE, payload: { from, to, reason }
- Return: { success: true }

---

## Task 6 — Admin Fraud Signal UI

On /admin/listings/[id] page, add Fraud Signals section:
- List all FraudSignals for this listing
- Show: type, severity badge, source, description, status, reportedAt
- If status OPEN or INVESTIGATING: "Resolve" and "Dismiss" buttons
- Resolve: POST /api/admin/fraud-signals/[signalId]/resolve
- Dismiss: POST /api/admin/fraud-signals/[signalId]/dismiss

Both routes: admin auth, update signal status, write AdminAction.

---

## Deliverables

## Files Created
- [ ] middleware.ts (updated or created)
- [ ] app/(admin)/admin/verifications/page.tsx
- [ ] app/(admin)/admin/verifications/[requestId]/page.tsx
- [ ] app/(admin)/admin/listings/page.tsx
- [ ] app/api/admin/listings/[listingId]/trust-components/route.ts
- [ ] app/api/admin/verifications/[requestId]/review/route.ts
- [ ] app/api/admin/listings/[listingId]/risk-state/route.ts
- [ ] app/api/admin/fraud-signals/[signalId]/resolve/route.ts
- [ ] app/api/admin/fraud-signals/[signalId]/dismiss/route.ts

## Admin Auth Status
- Detected pattern: <role field / isAdmin / separate model / UNKNOWN>
- Protection implemented: yes / no / BLOCKED

## Flags
- ⚠️ Any missing AdminActionType enum values (need schema migration?)
- ⚠️ Admin auth BLOCKER if pattern unclear
