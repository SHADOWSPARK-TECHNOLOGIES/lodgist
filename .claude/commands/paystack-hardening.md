# /paystack-hardening

Audit and harden the Paystack integration for production safety.

## Audit Steps

1. Find payment routes: `find lodgist/app/api/payments -name "*.ts" | xargs cat`
2. Find webhook handler: `find lodgist/app/api -name "*.ts" | xargs grep -l "paystack\|webhook" | head -5`
3. Check env vars: `grep -i paystack lodgist/.env 2>/dev/null | cut -d= -f1`
4. Check Vercel env: `vercel env ls | grep -i paystack`

## Required Checklist

For each payment route, verify:

**Initiate Payment (`/api/payments/initiate`)**
- [ ] Auth check — only authenticated users can initiate
- [ ] Amount validated — not manipulable from client
- [ ] Reference generated server-side (not from client)
- [ ] `PAYSTACK_SECRET_KEY` used from env, never hardcoded

**Verify Payment (`/api/payments/verify`)**
- [ ] Re-verify with Paystack API server-to-server (don't trust client status)
- [ ] Idempotency — check if reference already processed before acting
- [ ] Update booking/escrow status only on confirmed PAYSTACK success
- [ ] Log every verification attempt with timestamp and status

**Webhook Handler**
- [ ] Signature verification using `x-paystack-signature` header
  ```ts
  import { createHmac } from "crypto";
  const hash = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(JSON.stringify(body))
    .digest("hex");
  if (hash !== req.headers["x-paystack-signature"]) return 401;
  ```
- [ ] Idempotent — store processed event IDs, skip duplicates
- [ ] Handle: `charge.success`, `charge.failed`, `refund.processed`
- [ ] Never trust `amount` from webhook body alone — re-verify via API

**Environment**
- [ ] `PAYSTACK_SECRET_KEY` present in Vercel env (production + preview)
- [ ] `PAYSTACK_PUBLIC_KEY` present
- [ ] Webhook URL registered in Paystack dashboard pointing to `/api/webhooks/paystack`

## Output Format

```
## Paystack Audit Result

### Routes Found
- [path]: [PASS/FAIL per checklist item]

### Missing Env Vars
- [var name]: ACTION REQUIRED

### Webhook Status
- Signature verification: PASS / FAIL / NOT IMPLEMENTED
- Idempotency: PASS / FAIL / NOT IMPLEMENTED

### Critical Fixes Required (do these first)
1. [fix]

### Recommended Hardening (do these after)
1. [improvement]
```
