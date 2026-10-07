# HANDOFF

Updated: 2026-10-07

This file supersedes the 2026-10-05 Paystack-first payment instructions. A rental-check fee is not paid by opening Paystack, returning from Paystack, sending a success flag, opening WhatsApp, or uploading a screenshot. Only a STUDIO_ADMIN confirmation of a stored transfer reference marks the fee paid. That confirmation does not verify the home.

Do not use PATCH /api/bookings/:id/manual-payment or PATCH /api/bookings/:id/verify-payment for this fee. Those routes are booking payments.

## NOW

Branch feat/rental-check-manual-payment, based on origin/main a1d42154. Not merged. Not deployed. The additive migration has not been applied to production.

The check fee is ₦5,000, stored as amountNgn 5000. It is a service fee, not rent and not a deposit. No bank account, WhatsApp number, delivery time, or refund term is published here. NEXT_PUBLIC_SUPPORT_WHATSAPP is unset, so the public site has no pay button and no payment destination.

Host: the Express API in NEXT_PUBLIC_API_URL. lodgist.online/api and api.lodgist.ng are not this API.

## Implemented and tested

Customer token is the accessToken from create. Send it as header x-rental-check-token, body token, or query token. Staff calls use Authorization: Bearer <JWT> with role STUDIO_ADMIN.

POST /api/rental-checks
No account required. Creates an unpaid case. Status SUBMITTED, paymentStatus UNPAID.
201 data includes publicReference, accessToken, status, paymentStatus, reviewStatus, amountNgn, paymentReferenceSubmitted (false), reportReady, createdAt, product.
400 if intake is invalid. 500 if save fails.

POST /api/rental-checks/:reference/payment-reference
Auth: case token, or a STUDIO_ADMIN JWT. Body: { "manualPaymentRef": "<string>" }. A success flag is ignored. A screenshot, photo, image, or file field is rejected. A 13 to 19 digit card-shaped string is rejected. Card, CVV, PIN, OTP, and password keys are rejected.
200 sets paymentStatus PENDING and, if the case was SUBMITTED, status AWAITING_PAYMENT. Customer responses use the public view and do not include manualPaymentRef. They do include paymentReferenceSubmitted true. A STUDIO_ADMIN caller receives the admin view, which includes manualPaymentRef.
Same reference while PENDING returns alreadySubmitted true and does not rewrite paymentSubmittedAt.
Already PAID returns alreadyPaid true and does not change the row.
401 "This case link is not valid." Another case's token is 401.
400 "A payment reference is required." / "That reference is too long." / "Do not send a card number. Send the transfer reference." / "Screenshot upload is not available. A file does not confirm payment." / "Do not send card numbers, PINs, or OTPs."
409 "This case is cancelled."

PATCH /api/rental-checks/:reference/payment-review
Auth: Bearer JWT, role STUDIO_ADMIN only. Body: { "action": "confirm" | "reject", "note"?: string }.
confirm requires paymentStatus PENDING and a stored manualPaymentRef. It sets paymentStatus PAID, status UNDER_REVIEW unless the case was already further along, paidAt, paymentReviewedBy, and paymentReviewedAt.
A second confirm returns alreadyPaid true and does not change paidAt.
reject sets paymentStatus FAILED, clears manualPaymentRef, and stores the rejected reference in paymentReviewNote. The fee stays unpaid. A new reference can then be submitted.
401 if the bearer token is missing or invalid ("Missing or invalid authorization header", or "Authentication required" if a user object is absent).
403 "Forbidden: Requires role 'STUDIO_ADMIN'". A TENANT token was tested and did not write.
400 "action must be confirm or reject."
409 "There is no payment reference waiting for review."
409 "This fee is already confirmed." if reject is sent after PAID.

GET /api/rental-checks/:reference
No token required. Returns the public view only. After confirm, a later GET still returns paymentStatus PAID and paymentReferenceSubmitted true, and does not return manualPaymentRef. This reload was tested in the route test, not against production Postgres.

POST /api/rental-checks/:reference/pay
Implemented, and tested not to mark paid. With or without PAYSTACK_SECRET_KEY it returns 503 code PAYSTACK_UNAVAILABLE, unless the fee is already PAID (then alreadyPaid true) or the case is cancelled (409). A body success flag does not pay the fee. Android must not treat this as checkout.

POST /api/rental-checks/pay/verify
Implemented, and tested not to mark an unpaid fee paid. A success flag returns 409 code MANUAL_REVIEW_REQUIRED. If the fee is already PAID, it returns alreadyPaid true and does not write. Android must not use this to confirm a fee.

POST /api/payments/webhook
A signed rental-check charge.success is accepted and does not change paymentStatus. Booking and escrow webhook behaviour is unchanged.

Payment status values: UNPAID, PENDING, PAID, FAILED.
Case status after this flow: SUBMITTED, then AWAITING_PAYMENT, then UNDER_REVIEW on confirm. Reject does not set PAID.

## Not implemented

No public payment destination. No bank details. No WhatsApp pay link. No delivery promise. No refund terms. The public case page does not call pay, does not open Paystack, and does not treat a file or a chat click as payment. Staff record and confirm a reference in the reviewer screen at /admin/rental-checks.

Do not integrate a route that is only described above as not implemented.

## Migration and rollback

File: packages/db/prisma/migrations/20261007143000_rental_check_manual_payment/migration.sql
Adds nullable columns only: manualPaymentRef, paymentSubmittedAt, paymentReviewedBy, paymentReviewedAt, paymentReviewNote. No enum change. No row rewrite. Old rows stay valid with nulls.
Apply it before deploying the API that reads those columns. Do not run it against production from this session.
Rollback the app first, then drop those five columns. Dropping them before rolling back the app will make the new API fail on read.

## VERIFY

backend npm test: 108 passed.
frontend npm test: 23 passed.
Not run: production migration, a live Paystack charge, a browser click-through, an emulator.

## NEXT

A person applies the additive migration on the database this API uses, then deploys this branch. Until that happens, Android must not call these routes on a host still running main.
