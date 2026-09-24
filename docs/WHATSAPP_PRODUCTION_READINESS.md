# WhatsApp booking — production steps still external

Local booking is implemented in `lodgist/lib/whatsapp/` and `lodgist/app/api/whatsapp/webhook/route.ts`. It writes the existing `Booking` row with `sourceChannel: whatsapp`. Nothing below has been executed.

## Human actions, in order

1. **Rotate credentials.** `github.authkey` is still in Git history. Untracking it does not rotate it. Rotate that credential in GitHub, then purge history only with an explicit history-rewrite approval.
2. **Meta app credentials.** Set `WHATSAPP_VERIFY_TOKEN` to the token from the Meta app. Phone number id and Cloud API token are still absent, so outbound sends stay unwired.
3. **Production environment.** Set the app database URL, auth secret, and `WHATSAPP_VERIFY_TOKEN` on the host. Do not copy the local throwaway Postgres URL.
4. **Deploy** the `lodgist` app from the reviewed branch. Do not deploy from this document.
5. **Live webhook verification.** Set `WHATSAPP_APP_SECRET` (Meta HMAC-SHA256 of the raw body, header `X-Hub-Signature-256`) and `TWILIO_AUTH_TOKEN` (Twilio HMAC-SHA1, header `X-Twilio-Signature`). Missing or invalid signatures return 403. Unsigned local JSON is rejected when `NODE_ENV=production`. Then subscribe the production HTTPS URL. `GET /api/whatsapp/webhook` echoes `hub.challenge` only when `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`.
6. **Production smoke test.** From a real WhatsApp number: ask for a place and two `YYYY-MM-DD` dates, reply with the option number, confirm one `PENDING` booking in the admin recent-bookings table (`whatsapp` channel), then resend is rejected as a duplicate.

## Local limits that remain

- Option lists live in process memory and disappear on restart. Bookings stay in Postgres.
- Stay dates are calendar dates stored at UTC midnight.
- Two guests booking the same listing at the same moment can still race; the same message id cannot.
