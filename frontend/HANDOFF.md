# HANDOFF

Updated: 2026-10-07

Project: Lodgist frontend (`frontend/`), live site https://lodgist.online
Task: Confirm the paid Rental Safety Check is reachable, and do not invent the payment setup.
Owner: Cursor frontend agent. This record covers the 2026-10-07 check only. No other agent ownership file was present.

## NOW

No code change. The paid path is on the live site. A visitor can open the check form. Saving a real case and taking payment still belong to a person with the host configuration.

## BLOCKED

Paystack and WhatsApp send need host env vars. Names stay in the deployment report. Do not invent keys. Do not run the rental-check migration against production from an agent branch. Public listings stay empty until a person approves a real home.

## NEXT

A person applies the additive migration if production does not already have it, sets Paystack and the public site URL, and sends one test payment in Paystack test mode.

## VERIFY

Live checks on 2026-10-07, no case submitted:

- `https://lodgist.online/nekede?v=1` returned HTTP 200 from `railway-hikari`. The response contained `Nothing to rent here yet` twice, `Example Lodge` twice, and `not a home` four times.
- `https://lodgist.online/` contained `CHECK A RENTAL BEFORE I PAY`.
- `https://lodgist.online/check` returned HTTP 200. Title: `Check a rental before you pay | Lodgist`. The page showed `₦5,000`.
- `POST https://lodgist-api-production.up.railway.app/api/rental-checks` with `{}` returned HTTP 400 and fields `customerPhone`, `location`, `askingRent`. That request does not create a case.

Local suites on 2026-10-07, in-memory only, no production write:

- `cd frontend && npm test`: 22 passed, 0 failed.
- `cd backend && npm test`: 107 passed, 0 failed.
- The rental-check suite creates a case, returns 503 for pay while Paystack is unset, then accepts a fake ₦5,000 confirmation. The published report text does not say the home is verified.

Not run: a live case submit and a live Paystack checkout. Those stay with a person who holds the host keys.

## LAST

Workspace for this note: branch `cursor/rental-check-handoff-e85f`, parent `origin/main` `a1d42154`. The spatial-lab branch was left as already pushed. No Hermes channel was available, so this file is the handoff and receipt was not claimed.

Production relationship verified now: `lodgist.online` and `lodgist-api-production.up.railway.app` answer through Railway. Which git revision those services built was not compared to a commit. Historical notes that name a Vercel owner or an older Railway success were not re-checked.
