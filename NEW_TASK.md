# NEXT_TASK.md — Lodgist

## Active Mission
Make the manual/social/chatbot-assisted booking flow fully auditable and support-ready for private beta.

## Why This Task Matters
Lodgist’s current beta path depends on leads and conversions coming from WhatsApp, social media, or chatbots.
That means the backend must not only process bookings and manual payments, but also preserve enough operational context for admin review, support, fraud checks, and dispute handling.

## Current Context
Assume the following is already mostly working unless code proves otherwise:
- Auth flow exists
- Booking flow exists
- Manual payment submission exists
- Payment verification exists
- Neon-backed persistence exists
- Paystack dashboard automation is deferred for now
- Private beta uses manual/concierge handling first

## Task Type
- [ ] Audit only
- [x] Implement missing backend piece
- [x] Harden security/permissions
- [x] Improve persistence/data model
- [x] Add operational/admin support flow
- [ ] Fix bug blocking beta
- [x] Update readiness docs

## Exact Objective
Audit and implement the smallest missing backend support for manual/social/chatbot-assisted operations by ensuring bookings and payment verification flows capture operational context and audit evidence.

Specifically:
1. Check whether the backend stores useful support/audit data for concierge operations, such as:
   - source channel (WhatsApp, Instagram, Facebook, chatbot, manual admin, etc.)
   - internal/admin notes
   - verifier identity
   - verification timestamp
   - rejection/cancellation reason
2. If any of the above is missing and can be added safely with small changes, implement it.
3. Verify that admin-only actions are properly protected.
4. Verify that booking/payment state transitions remain safe after the change.
5. Update BETA_STATUS.md with the new readiness state.

## Scope
Work only in:
- backend files
- Prisma schema/migrations if required
- booking/payment route handlers
- auth/permission middleware
- audit/logging utilities
- BETA_STATUS.md

Do not:
- edit unrelated frontend files
- ask for Paystack dashboard login
- treat webhook wiring as current blocker
- redesign the product
- make destructive schema changes

## Acceptance Criteria
The task is complete only if all are true:

1. The codebase is inspected for concierge/audit data support.
2. Missing high-value fields or logic are added only if they are small and safe.
3. Admin/payment verification actions remain properly protected.
4. State transitions are still valid and abuse-resistant.
5. Relevant routes or flows are tested.
6. BETA_STATUS.md is updated.
7. Final report lists exact files changed and exact readiness improvement.

## Suggested Work Plan
1. Inspect Prisma models related to booking/payment.
2. Inspect manual payment and verify-payment endpoints.
3. Inspect admin/role middleware.
4. Identify missing operational/audit fields.
5. Implement the smallest safe improvement.
6. Test the affected paths.
7. Update BETA_STATUS.md.
8. Stop.

## Relevant Files
- packages/db/prisma/schema.prisma
- packages/db/prisma.config.ts
- backend booking routes
- backend payment verification routes
- auth/role middleware
- BETA_STATUS.md

## End-of-Task Report Format
Return only:

### Inspected
- file path
- file path

### Changed
- file path — short reason
- file path — short reason

### Tested
- endpoint/test/command — result
- endpoint/test/command — result

### Outcome
- what is now true
- any remaining risk
- whether this improved private beta readiness

## Priority Rule
Do not branch into Paystack dashboard setup, frontend work, or unrelated cleanup.
Finish this single objective first.

## Stop Conditions
Stop only if:
- the task is complete,
- a true external blocker exists,
- a required secret/credential is missing,
- or a safe implementation would require major scope expansion.

## Current Objective
Make manual/social/chatbot-assisted booking and payment verification flows operationally auditable for private beta.

## Notes
Use the current go-to-market model as the decision filter:
if it improves trust, admin control, supportability, or fraud resistance for manual beta operations, it is in scope.# NEXT_TASK.md — Lodgist

## Active Mission
Make Lodgist backend fully ready for limited private beta using social media and chatbot-assisted operations.

## Why This Task Matters
Lodgist’s current launch path is not full in-app automation first. It is a trust-first concierge flow:
- lead comes from WhatsApp/social/chatbot,
- booking is created or confirmed,
- user submits payment reference,
- admin verifies or rejects,
- backend stores the audit trail and correct status.

This task exists to remove the next highest-value backend blocker in that flow.

## Current Context
Assume the following is already true unless code proves otherwise:
- Frontend is largely market-ready.
- Backend has strong progress on auth, booking flow, manual payment submission, payment verification, and Neon persistence.
- Paystack dashboard/browser setup is deferred unless required for the manual beta flow.
- The goal is operational reliability for a private beta, not maximum feature breadth.

## Task Type
Choose one:
- [ ] Audit only
- [ ] Implement missing backend piece
- [ ] Harden security/permissions
- [ ] Improve persistence/data model
- [ ] Add operational/admin support flow
- [ ] Fix bug blocking beta
- [ ] Update readiness docs

## Exact Objective
[Write one specific goal only.]

Examples:
- Ensure all manual payment verification actions store audit metadata.
- Add source-channel tagging for social/chatbot-assisted bookings.
- Remove in-memory dependency from critical transaction flow.
- Harden admin-only verification routes.
- Update BETA_STATUS.md after verifying current backend state.

## Scope
Work only in:
- backend files
- Prisma schema/migrations if needed
- route handlers
- auth/permission middleware
- audit/logging utilities
- readiness markdown files

Do not:
- edit unrelated frontend files
- ask for dashboard login
- pause on deferred integrations
- make destructive schema changes without strong reason
- expand scope beyond the exact objective

## Acceptance Criteria
The task is complete only if all are true:

1. The specific objective is implemented or verified.
2. Changes are minimal and production-oriented.
3. Relevant auth, ownership, and role checks are preserved or improved.
4. Critical data is persisted correctly.
5. Meaningful tests or endpoint checks are run.
6. BETA_STATUS.md is updated if readiness changed.
7. Final report is concise and file-specific.

## Suggested Work Plan
1. Inspect relevant files first.
2. Confirm current behavior from code.
3. Implement the smallest correct change.
4. Test affected paths.
5. Update readiness docs if needed.
6. Stop after the objective is done.

## Relevant Files
List likely files before starting:
- [path/to/file]
- [path/to/file]
- [path/to/file]

## End-of-Task Report Format
Return only:

### Inspected
- file path
- file path

### Changed
- file path — short reason
- file path — short reason

### Tested
- endpoint/test/command — result
- endpoint/test/command — result

### Outcome
- what is now true
- any remaining risk
- whether this improves private beta readiness

## Priority Rule
If multiple issues are visible, do not branch out.
Finish the single active objective first.

## Stop Conditions
Stop only if:
- the task is complete,
- a true external blocker exists,
- a required secret/credential is missing,
- or the task would require unrelated scope expansion.

## Current Objective
[Fill this in before each session.]

## Notes
[Optional short notes]
