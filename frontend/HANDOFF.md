# HANDOFF

Updated: 2026-10-08

Paystack checkout is shelved. A Rental Safety Check fee and a booking payment are arranged on WhatsApp and confirmed by staff. Opening WhatsApp does not mark the fee paid. A missing PAYSTACK_SECRET_KEY must not break these pages.

The support number is NEXT_PUBLIC_SUPPORT_WHATSAPP on the lodgist web service. Do not hardcode a number. The rejected test number +2349045770572 must not be used.

## NOW

Case page `/check/[reference]` shows "Arrange this fee on WhatsApp" when the fee is not staff-confirmed and the env var is set. The click stores manual payment reference `WHATSAPP <publicReference>` through POST `/api/rental-checks/:reference/payment-reference`, which sets paymentStatus PENDING and status AWAITING_PAYMENT. Staff still confirm or reject on `/admin/rental-checks`.

A listing page booking in PENDING uses PATCH `/api/bookings/:id/manual-payment` with `WHATSAPP <booking id>`, which sets PENDING_VERIFICATION. Staff still use PATCH `/api/bookings/:id/verify-payment`. A booking already in PENDING_VERIFICATION only opens WhatsApp.

The frontend does not call Paystack initialize. Backend initiate routes stay, and return 503 PAYSTACK_UNAVAILABLE unless PAYSTACK_ENABLED is the string true and PAYSTACK_SECRET_KEY is set. The HMAC-SHA512 webhook is unchanged.

No schema change in this task.
