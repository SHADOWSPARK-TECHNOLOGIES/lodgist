# Debug & Audit Prompts — Lodgist
# Paste whichever block is relevant into Claude CLI

---

## AUDIT: Schema Integrity Check

Scan prisma/schema.prisma. Do not modify anything.
Report as a checklist:

Models:
- [ ] VerificationRequest model exists
- [ ] FraudSignal model exists
- [ ] TrustComponent model exists
- [ ] AdminAction model exists

Enums:
- [ ] RiskState: VERIFIED, UNVERIFIED, UNDER_REVIEW, FLAGGED, SUSPENDED
- [ ] VerificationStatus: PENDING, IN_REVIEW, APPROVED, REJECTED, NEEDS_MORE_INFO
- [ ] FraudSignalType (all 7 values)
- [ ] SignalSeverity: LOW, MEDIUM, HIGH, CRITICAL
- [ ] SignalSource: SYSTEM, USER_REPORT, ADMIN_MANUAL, AGENT_REPORT
- [ ] SignalStatus: OPEN, INVESTIGATING, RESOLVED, DISMISSED
- [ ] AdminActionType (all 5 values)

Listing model fields:
- [ ] riskState: RiskState @default(UNVERIFIED)
- [ ] truthIndex: Int?
- [ ] verificationRequests relation
- [ ] fraudSignals relation
- [ ] trustComponents relation

User model relations:
- [ ] verificationSubmissions
- [ ] verificationReviews
- [ ] fraudReports
- [ ] fraudResolutions
- [ ] adminActions

Indexes:
- [ ] VerificationRequest: listingId, status, submittedById
- [ ] FraudSignal: listingId, status, severity
- [ ] TrustComponent: listingId, @@unique([listingId, componentKey])
- [ ] AdminAction: adminId, targetListingId

---

## DEBUG: Trust API returning wrong shape

Check the trust API route:
1. Print the exact file path of the trust API handler
2. Print its full contents
3. Confirm it returns exactly this shape and nothing else:
   {
     riskState: string,
     truthIndex: number | null,
     verificationStatus: string | null,
     components: [{ label, passed, weight, notes? }]
   }
4. Confirm these fields are NOT present in the response:
   documentUrls, fraudSignals, metadata, reviewNote, submittedById, reviewedById
5. Confirm 404 is returned when listing does not exist
6. Confirm initializeTrustComponents is called if no components exist

Run a test:
npx ts-node -e "
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.listing.findFirst({ select: { id: true } }).then(l => {
  console.log('Test listing ID:', l?.id)
  prisma.\$disconnect()
})
"

Then: curl http://localhost:3000/api/listings/<that-id>/trust

---

## DEBUG: TruthIndex not updating

Check computeTruthIndex logic:
1. Print contents of lib/trust/computeTruthIndex.ts
2. Verify weights sum to 100:
   30 + 25 + 20 + 10 + 10 + 5 = 100 ✓
3. Run syncTruthIndex manually for a listing:
   npx ts-node -e "
   const { PrismaClient } = require('@prisma/client')
   const { syncTruthIndex } = require('./lib/trust/computeTruthIndex')
   const prisma = new PrismaClient()
   prisma.listing.findFirst().then(async l => {
     const score = await syncTruthIndex(l.id, prisma)
     console.log('Computed score:', score)
     await prisma.\$disconnect()
   })
   "
4. Check the Listing in DB: select id, "truthIndex", "riskState" from "Listing" limit 3;

---

## DEBUG: Migration failed

When a migration fails, run:
1. npx prisma migrate status
2. npx prisma db pull (shows current DB state vs schema)
3. cat prisma/migrations/ (list migration history)
4. Report the EXACT error message — do not attempt to fix without reporting it

Common causes:
- Enum already exists in DB: drop the enum manually or create migration to add missing values
- Relation naming conflict: check @relation names for duplicates
- Column already exists: use addColumn migration instead of recreate

---

## DEBUG: PropertyCard badge not showing

1. Find PropertyCard file: find components -name "PropertyCard*" -o -name "ListingCard*"
2. Print its full contents
3. Confirm:
   - riskState prop is in the props interface
   - RiskStateBadge is imported
   - The image wrapper has position: relative
   - RiskStateBadge has absolute top-2 right-2 z-10
4. Check the page that renders PropertyCard — is riskState being passed in?
   If not: show how to pass it from the listing query
5. Check the listing query — does it select riskState?

---

## AUDIT: Public API surface (security check)

Check every route under /api/listings/:
1. Print the response shape of each route
2. Flag any route that returns:
   - documentUrls
   - fraudSignals or any fraud data
   - reviewNote or reviewedById
   - metadata (Json fields)
   - internal user IDs beyond what's needed
3. Check each route for auth:
   - GET /api/listings/[id]/trust — should be PUBLIC (read-only, sanitized)
   - POST /api/listings/[id]/verify — should require AUTH
   - All /api/admin/* — should require ADMIN role
Report pass/fail for each.

---

## UTIL: Regenerate seed data

Run this when you need fresh test data:

npx ts-node prisma/seed-trust.ts

If it fails because listingIds don't exist:
1. Check if any listings exist: npx ts-node -e "
   const { PrismaClient } = require('@prisma/client')
   const p = new PrismaClient()
   p.listing.findMany({ take: 5, select: { id: true, title: true } }).then(console.log)
   "
2. If no listings exist, run the main seed first: npx ts-node prisma/seed.ts
3. Then re-run: npx ts-node prisma/seed-trust.ts
