# HANDOFF

Updated: 2026-10-07

Project: Lodgist frontend (`frontend/`), live site https://lodgist.online
Task: Confirm the paid Rental Safety Check is reachable, and do not invent the payment setup.
Owner: Cursor frontend agent. This record covers the 2026-10-07 check only. No other agent ownership file was present.

## NOW

No code change. The paid path is on the live site. A visitor can open the check form. Saving a real case and taking payment still belong to a person with the host configuration.

## BLOCKED

WhatsApp send needs host env vars. Names stay in the deployment report. Do not invent keys. Do not run the rental-check migration against production from an agent branch. Public listings stay empty until a person approves a real home.
Updated: 2026-10-08

Paystack checkout is retired (8 Oct 2026, PR #64; code removed). A Rental Safety Check fee and a booking payment are arranged on WhatsApp and confirmed by staff. Opening WhatsApp does not mark the fee paid.

The support number is NEXT_PUBLIC_SUPPORT_WHATSAPP on the lodgist web service. Do not hardcode a number. The rejected test number +2349045770572 must not be used.

A person applies the additive migration if production does not already have it, sets the public site URL, and confirms one WhatsApp payment reference through staff review.

## VERIFY

Live checks on 2026-10-07, no case submitted:

- `https://lodgist.online/nekede?v=1` returned HTTP 200 from `railway-hikari`. The response contained `Nothing to rent here yet` twice, `Example Lodge` twice, and `not a home` four times.
- `https://lodgist.online/` contained `CHECK A RENTAL BEFORE I PAY`.
- `https://lodgist.online/check` returned HTTP 200. Title: `Check a rental before you pay | Lodgist`. The page showed `₦5,000`.
- `POST https://lodgist-api-production.up.railway.app/api/rental-checks` with `{}` returned HTTP 400 and fields `customerPhone`, `location`, `askingRent`. That request does not create a case.

Local suites on 2026-10-07, in-memory only, no production write:

- `cd frontend && npm test`: 22 passed, 0 failed.
- `cd backend && npm test`: 107 passed, 0 failed.
- The rental-check suite creates a case, then accepts a fake ₦5,000 confirmation. The published report text does not say the home is verified.

Not run: a live case submit. Those stay with a person who holds the host keys.
## NOW

Case page `/check/[reference]` shows "Arrange this fee on WhatsApp" when the fee is not staff-confirmed and the env var is set. The click stores manual payment reference `WHATSAPP <publicReference>` through POST `/api/rental-checks/:reference/payment-reference`, which sets paymentStatus PENDING and status AWAITING_PAYMENT. Staff still confirm or reject on `/admin/rental-checks`.

A listing page booking in PENDING uses PATCH `/api/bookings/:id/manual-payment` with `WHATSAPP <booking id>`, which sets PENDING_VERIFICATION. Staff still use PATCH `/api/bookings/:id/verify-payment`. A booking already in PENDING_VERIFICATION only opens WhatsApp.

The frontend does not call Paystack. The backend Paystack initiate, verify, escrow hold/release and webhook routes were removed; they now 404. Prisma paystack* columns and EscrowTransaction/ProcessedWebhookEvent rows are kept for history.

Workspace for this note: branch `cursor/rental-check-handoff-e85f`, parent `origin/main` `a1d42154`. The spatial-lab branch was left as already pushed. No Hermes channel was available, so this file is the handoff and receipt was not claimed.

Production relationship verified now: `lodgist.online` and `lodgist-api-production.up.railway.app` answer through Railway. Which git revision those services built was not compared to a commit. Historical notes that name a Vercel owner or an older Railway success were not re-checked.
No schema change in this task.
