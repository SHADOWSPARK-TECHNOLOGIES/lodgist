# HANDOFF

Updated: 2026-10-05

## NOW

Rental Safety Check is the paid path. Homepage primary CTA is CHECK A RENTAL BEFORE I PAY. A visitor submits a case, pays ₦5,000, and a reviewer publishes a report. Unknown evidence stays labelled. Payment does not verify a home.

## BLOCKED

Paystack and WhatsApp send need host env vars. Names are in the deployment report. Do not invent keys. Do not run the rental-check migration against production from this branch. Public listings stay empty until a person approves a real home.

## NEXT

A person applies the additive migration, sets Paystack and the public site URL, and sends one test payment in Paystack test mode.

## VERIFY

`cd frontend && npm test`

`cd backend && npm test`

Open `/check`. Submit a case. Confirm the case reference and the pay step. Confirm the report page does not call the home verified.

## LAST

`/nekede` and `/nekede/supply` still explain the Owerri pilot and do not publish a home. Example Lodge stays labelled not a home.
