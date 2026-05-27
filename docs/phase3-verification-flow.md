# Phase 3 — Verification Flow
# Paste this entire block into Claude CLI

Read CLAUDE.md before proceeding. All rules there apply here.
Phase 1 (schema) and Phase 2 (UI components) must be complete before this phase.

## Pre-flight
1. Confirm TrustPanel, RiskStateBadge, TruthIndexMeter exist in components/trust/
2. Confirm GET /api/listings/[id]/trust exists and returns correct shape
3. Check file storage: cat package.json | grep -E "cloudinary|@aws-sdk|blob|uploadthing"
4. Check email: cat package.json | grep -E "resend|nodemailer|sendgrid"
5. Confirm auth pattern: cat package.json | grep -E "next-auth|@clerk|jose"
Report findings. Then proceed.

---

## Task 1 — Verification Submission Page

Create: app/verify/[id]/page.tsx (App Router) OR pages/verify/[id].tsx (Pages Router)

Page requirements:
- Route: /verify/[listingId]
- Auth-protected: redirect to login if not authenticated
- Fetch listing data to show listing title + address at top
- Fetch /api/listings/[id]/trust — if riskState is already VERIFIED, show 
  "This listing is already verified" and link back to the listing
- If a PENDING or IN_REVIEW VerificationRequest already exists for this listing
  from this user, show status screen (not the form)

Form layout:
```
Heading: "Verify This Property"
Subtext: "Submit documents for review. Our team will verify within 2–5 business days."

Section 1: "Document Upload"
- Title Document (C of O, Deed of Assignment, Survey Plan) — required
  File input: accepts PDF, JPG, PNG. Max 5MB each.
- Government-issued ID of owner — required
- Any additional supporting documents — optional (up to 3 files)

Section 2: "Landlord Consent"
- Checkbox: "I confirm I am the property owner or authorized agent"
- Checkbox: "I consent to Lodgist verifying this information"
Both required.

Section 3: "Notes (Optional)"
- Textarea: "Add any context that might help our review team"
- Max 500 characters

Submit button: "Submit for Verification" (orange, full width on mobile)
Below: "Your documents are stored securely and only reviewed by our trust team."
```

Client-side validation:
- At least one title document uploaded
- Both checkboxes checked
- No file exceeds 5MB
- Show field-level error messages (not just toast)

On submit:
- POST to /api/listings/[id]/verify
- Show loading state on button
- On success: show success screen (see below)
- On error: show error message, keep form state

Success screen:
```
✓ icon (teal)
"Verification Submitted"
"We've received your documents. Our team will review within 2–5 business days.
You'll be notified by email when the status changes."
[View Listing] button
```

---

## Task 2 — POST /api/listings/[id]/verify

Create: app/api/listings/[id]/verify/route.ts OR pages/api/listings/[id]/verify.ts

Handler logic:
1. Auth check — get session user. Return 401 if not authenticated.
2. Validate listingId param — return 404 if listing not found.
3. Check for existing open VerificationRequest:
   - If one exists with status PENDING or IN_REVIEW: return 409 with message
     "A verification request is already in progress for this listing."
4. Handle file uploads:
   - If Cloudinary: use cloudinary.uploader.upload()
   - If Vercel Blob: use put() from @vercel/blob
   - If S3: use PutObjectCommand
   - Detect from installed packages. Report if none found — do not fake it.
   - Upload each file. Collect URLs into documentUrls: string[]
5. Create VerificationRequest:
   ```ts
   await prisma.verificationRequest.create({
     data: {
       listingId,
       submittedById: session.user.id,
       status: 'PENDING',
       documentUrls,
       notes: body.notes || null,
     }
   })
   ```
6. Update listing riskState to UNDER_REVIEW:
   ```ts
   await prisma.listing.update({
     where: { id: listingId },
     data: { riskState: 'UNDER_REVIEW' }
   })
   ```
7. Log AdminAction:
   ```ts
   // Only if an admin triggered this — skip for user submissions
   // This endpoint is user-facing, so no AdminAction needed here
   ```
8. Send notification email (if email provider installed):
   - To: admin notification email (from env: ADMIN_NOTIFY_EMAIL)
   - Subject: "New Verification Request — [listing title]"
   - Body: listing ID, submitter name, document count
   - If no email provider: skip and log "EMAIL_PROVIDER_NOT_CONFIGURED"
9. Return 201: { success: true, requestId: <id>, status: 'PENDING' }

Error handling:
- File too large: return 400 "File exceeds 5MB limit"
- Wrong file type: return 400 "Only PDF, JPG, and PNG files are accepted"
- DB error: return 500, log error server-side
- Never expose DB error messages to client

---

## Task 3 — Environment Variables Needed

Add to .env.local (and document in .env.example):
```
ADMIN_NOTIFY_EMAIL=trust@lodgist.com.ng
# File storage (use whichever provider is installed):
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
# OR
BLOB_READ_WRITE_TOKEN=   # Vercel Blob
```

Create or update .env.example with these keys (empty values).

---

## Task 4 — GET update for /api/listings/[id]/trust

Update the existing trust GET route to also return verificationStatus:
```ts
// Add to the response:
verificationStatus: latestRequest?.status ?? null
```

Fetch the most recent VerificationRequest for the listing:
```ts
const latestRequest = await prisma.verificationRequest.findFirst({
  where: { listingId },
  orderBy: { createdAt: 'desc' },
  select: { status: true }
})
```

---

## Deliverables

## Files Created
- [ ] app/verify/[id]/page.tsx (or pages equivalent)
- [ ] app/api/listings/[id]/verify/route.ts (or pages equivalent)
- [ ] .env.example (updated)

## Files Modified
- [ ] app/api/listings/[id]/trust/route.ts — added verificationStatus to response

## File Storage Decision
- Detected provider: <name or NONE>
- Action taken: <implemented / flagged as blocker>

## Email Decision
- Detected provider: <name or NONE>
- Action taken: <implemented / skipped with log>

## Flags
- ⚠️ Any missing env vars that will break the route
- ⚠️ Any auth pattern issues
- ⚠️ File upload provider missing (BLOCKER — verify flow cannot work without this)

## Verification
curl example for POST /api/listings/[id]/verify
Expected 201 response shape
Expected 409 response when duplicate request exists
