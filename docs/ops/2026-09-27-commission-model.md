# Objective 3B — Commission Model

**Date:** 2026-09-27  
**Trigger:** Payment provider (Paystack) IS wired → commission model, not payment integration plan  
**Status:** Draft — Tier 1 write, not yet applied

## 1. Current state

### What exists

- **Paystack is fully wired**: `paystackService.js` (initialize, verify, transfer, balance), `payments.js` (webhook with HMAC + idempotency), `escrow.js` (hold → release → transfer to landlord), `bookings.js` (initiate-payment → webhook-driven confirm).
- **Escrow flow is live and DB-backed**: `prisma.escrowTransaction` with states PENDING → HELD → RELEASED | DISPUTED | FAILED.
- **Release transfers the full amount to the landlord**: `escrow.js` POST /release calls `PaystackService.transferToLandlord({ amount: escrowTransaction.amount, ... })` — the entire escrow amount goes to the landlord, no platform cut.

### What is defined but not applied

- `backend/src/routes/transactions.js` (in-memory Map, NOT wired to Paystack, NOT DB-backed) defines:
  - `SPLIT = { tenant: 0.3, landlord: 0.3, platform: 0.4 }` (30/30/40)
  - `FACILITATION_FEE_RATE = 0.015` (1.5%)
  - Calculates `facilitationFee`, `netAmount`, `tenantShare`, `landlordShare`, `platformShare`
- This skeleton is dead code for the live flow — it uses a `Map`, not Prisma, and is never called by the escrow or bookings routes.

## 2. Recommendation

### Adopt a 5% platform facilitation fee on the gross escrow amount, collected at release time.

**Not** the 30/30/40 split from transactions.js. That split gives the platform 40% of the net — far too high for a Nigerian PropTech marketplace in 2026, where HomeLands charges flat 1% and Topdial caps at 10%/5%.

**Not** a flat 1% (HomeLands model) — Lodgist does more than listings: escrow holding, identity verification, fraud scoring, WhatsApp concierge. 1% does not cover the trust infrastructure cost.

**Not** MyAgent's 20% on rentals — that rate is for a full-service agent model (showing, negotiating, contracting). Lodgist is a marketplace + escrow + verification layer, not a full-service agent.

**Recommended: 5% facilitation fee on the gross amount, deducted at release, with the remainder split 50/50 between tenant's prepaid rent and landlord's receipt.**

Wait — re-examine. The escrow model here is: tenant pays the full rent into escrow, landlord gets paid after move-in. The tenant doesn't get a "share" — they already lived in the property. The 30/30/40 split in transactions.js is conceptually wrong for this flow: the tenant's 30% would be a refund, not a payout.

**Corrected recommendation:**

For the **escrow rental flow** (the primary revenue path):
- Platform facilitation fee: **5% of gross escrow amount**, deducted at release
- Landlord receives: **95% of gross escrow amount**
- Tenant receives: nothing (they already received the rental service; the escrow was their rent payment)
- The 5% covers: Paystack facilitation costs, trust/verification infrastructure, platform operations

For the **milestone payment flow** (future — not yet wired):
- Same 5% facilitation fee
- Milestone completions trigger proportional releases

This is defensible against the market comparables:
- HomeLands 1% flat: Lodgist does more (escrow + verification + fraud scoring), so 5% is justified
- Topdial 10%/5% cap: 5% is at the low end of that range
- MyAgent 20%: full-service agent model, not comparable to Lodgist's marketplace + escrow model

### Why 5% and not the 30/30/40 skeleton

The 30/30/40 split in transactions.js was probably drafted for a different business model (a three-way split where the tenant also gets a share). The current escrow flow is a two-party model (tenant pays, landlord receives after verification). Forcing the 30/30/40 split onto this flow would require giving the tenant 30% of their own rent back, which makes no sense.

The 1.5% facilitation fee in the skeleton is too low — it doesn't cover the trust infrastructure cost. 5% is the floor that covers Paystack fees ( ~1.5% + ₦100 per transaction for transfers) plus a margin for the verification and fraud-scoring infrastructure.

## 3. Where commission is calculated

**At escrow release time, in `escrow.js` POST /release.**

Current flow:
```
POST /release
  → balance check (Paystack getBalance)
  → createTransferRecipient (landlord's bank)
  → transferToLandlord({ amount: escrowTransaction.amount, ... })  // full amount
  → escrowTransaction.status = RELEASED
```

Proposed flow:
```
POST /release
  → balance check
  → commission = escrowTransaction.amount * 0.05   // 5% facilitation fee
  → landlordAmount = escrowTransaction.amount - commission
  → createTransferRecipient (landlord's bank)
  → transferToLandlord({ amount: landlordAmount, ... })  // 95% to landlord
  → record commission in escrowTransaction (commissionAmount, commissionRate)
  → escrowTransaction.status = RELEASED
```

The commission is calculated once, at release, from the gross escrow amount stored on the transaction. No separate commission calculation endpoint needed.

## 4. Where commission is stored

Add two fields to the `escrowTransaction` Prisma model:

```prisma
model escrowTransaction {
  // existing fields: id, tenantId, landlordId, listingId, amount, currency, status, ...
  commissionAmount   Float?   // amount withheld as platform fee (in NGN)
  commissionRate     Float?   // commission rate applied (0.05 = 5%)
  commissionCollected Boolean @default(false) // whether commission was deducted at release
}
```

The commission is stored on the escrow transaction itself, not in a separate commission table. This keeps the audit trail on the transaction record: you can see the gross amount, the commission deducted, and the net transfer amount from the single escrowTransaction record.

## 5. How commission is reconciled

### Reconciliation approach: Paystack transfer records + escrowTransaction audit trail

1. **At release**: Paystack transfer returns `transferCode`, `status`, `amount` (the amount actually transferred = landlordAmount = 95% of gross).
2. **Store on escrowTransaction**: `transferCode`, `transferStatus`, `transferAmount` (the net paid to landlord), `commissionAmount`, `commissionRate`.
3. **Daily reconciliation**: Query all escrowTransaction records where `status = RELEASED` and `commissionCollected = true` in the last 24 hours. Sum `commissionAmount`. Compare against Paystack dashboard transfer records for the same period (filtered by reference prefix `LODG-REL-`).
4. **Discrepancy handling**: If Paystack transfer amount ≠ stored `transferAmount`, flag the transaction for manual review (status → DISPUTED or a new `REVIEW` state).

### What Paystack gives us for reconciliation
- `transfer.success` webhook → already handled in `payments.js` → updates escrowTransaction to RELEASED
- The webhook payload includes the transfer reference, amount, and status
- The transfer reference `LODG-REL-<escrowRef>-<timestamp>` is derived from the escrow reference, so we can match transfers back to escrow transactions

### Gap: Paystack transfer webhook does not include the expected commission
The `transfer.success` webhook tells us the transfer went through and the amount transferred, but it doesn't tell us what the commission *should have been*. Reconciliation requires comparing the transferred amount against the expected 95% of the escrow amount. This is a computation on our side, not something Paystack provides.

## 6. What happens on refund

### Tenant-side refund (before release)
If the tenant cancels before move-in confirmation:
- `escrow.js` POST /refund (or a new endpoint) → status → REFUNDED
- No commission is collected (the escrow was never released)
- The full amount is refunded to the tenant via Paystack refund (if Paystack supports refund on the initialized transaction) or manual reversal
- `commissionCollected` remains false

### Post-release refund (after landlord paid)
If a dispute arises after release (e.g., landlord fraud, property not as described):
- This is a-edge case requiring manual intervention
- Lodgist would need to either:
  (a) Recover the commission from the landlord (if the landlord is at fault), or
  (b) Absorb the commission as a cost of the dispute (if Lodgist is at fault or it's a no-fault dispute)
- The commission model should document this: **commission is non-refundable once collected**, but the platform may choose to waive it in exceptional circumstances (documented as an admin action).

### Refund on failed payment (before hold)
If Paystack charge fails:
- `payments.js` handleChargeFailed → booking/escrow status → PENDING (or FAILED)
- No commission (no money was collected)
- Tenant can retry

## 7. Implementation order

1. **Add commission fields to escrowTransaction Prisma model** (migration)
2. **Patch escrow.js POST /release** to calculate and deduct commission before transfer
3. **Patch payments.js transfer.success webhook** to record commission on the escrow transaction (the webhook already updates status to RELEASED — add commission fields to that update)
4. **Add daily reconciliation query** (script or scheduled job, not tonight)
5. **Add admin reporting** (commission collected, by day, by listing — not tonight)

## 8. Comparison with market

| Platform | Model | Rate | Notes |
|----------|-------|------|-------|
| HomeLands | Flat commission | 1% | Listings-only marketplace, minimal infrastructure |
| Topdial | Capped commission | 10%/5% | Tenant/landlord split, cap at lower rate for repeat |
| MyAgent | Full-service agent | 20% on rentals | Showing, negotiating, contracting — full agent service |
| **Lodgist (proposed)** | Facilitation fee | 5% | Escrow + verification + fraud scoring + WhatsApp concierge |

## 9. Assumptions this model makes

1. The escrow flow is the primary revenue path — listings and subscriptions are secondary or not yet monetized.
2. 5% is sufficient to cover Paystack fees + trust infrastructure + platform operations — this needs validation against actual transaction volume and cost structure.
3. The 30/30/40 split in transactions.js is abandoned — it was drafted for a different model and is not applicable to the current escrow flow.
4. Commission is non-refundable once collected — this may need legal review for Nigerian consumer protection law.
5. Paystack transfer webhook provides sufficient reconciliation data — the transfer amount + reference match is enough for daily reconciliation; no additional Paystack API calls needed.
6. The commission is deducted from the landlord's payout, not the tenant's payment — the tenant pays gross, the landlord receives net. This is the standard marketplace model.

## 10. Adversarial self-review

Prompt: "Refute the recommendation in this document. Find the strongest argument against it. List every assumption it makes that could be wrong. If you cannot find a genuine refutation, say so. If you can, list it."

### Refutation

**Strongest argument against 5% facilitation fee: the 30/30/40 split in transactions.js may be the intended model, not a dead skeleton.**

The transactions.js file has a carefully constructed split with facilitation fee, net amount calculation, and three-way distribution. It was not randomly generated — someone wrote it with intent. The fact that it's in-memory and not wired to Paystack could mean it's a draft waiting to be wired, not dead code to be abandoned.

If the 30/30/40 split is the intended model, then:
- The tenant's 30% share makes sense if the tenant is also a landlord on the platform (round-trip user), or if it's a referral/rewards program (tenant gets 30% of the rent back as platform credit for future use).
- The platform's 40% share is high but defensible if Lodgist is positioning as a full-service trust platform (verification + escrow + fraud scoring + concierge), not just a listing marketplace.

**Counter to the counter:** The escrow.js release flow transfers the full amount to the landlord with no split. If the 30/30/40 split were the intended model, the release flow would distribute to three parties, not just the landlord. The release flow is the live, DB-backed, Paystack-integrated code — it reflects the actual business logic, not the in-memory skeleton. The skeleton is the anomaly, not the release flow.

### Other assumptions that could be wrong

1. **"5% covers costs" assumption**: I have no data on Lodgist's transaction volume, Paystack fee structure (volume discounts?), or operational costs. 5% could be too low (losing money on each transaction) or too high (driving tenants to competitors). This needs financial modeling with real numbers.

2. **"Commission is non-refundable" assumption**: Nigerian consumer protection law (Consumer Protection Council Act) may require refunds in certain dispute scenarios. If a tenant is defrauded and the platform took a 5% cut, the platform may be liable to refund that cut as part of the disgorgement. This needs legal review.

3. **"Tenant pays gross, landlord receives net" assumption**: This is the standard marketplace model, but some Nigerian rental platforms (e.g., RentSmallSmall) use a different model where the platform charges the tenant a separate service fee rather than deducting from the landlord's payout. The separate-fee model may be more transparent to landlords and less likely to cause landlord churn.

4. **"Escrow is the primary revenue path" assumption**: The founder's prompt mentions "a verified listing, a completed rental transaction, or a subscription." This model only addresses the completed rental transaction. If verification fees or subscriptions are the primary revenue path, the commission model is secondary.

5. **"Paystack transfer webhook is sufficient for reconciliation" assumption**: The transfer.success webhook gives us the transfer amount and reference, but if Paystack's transfer amount differs from what we requested (e.g., due to a partial transfer, currency conversion, or fee deduction on Paystack's side), we would not catch it without an additional API call to verify the transfer. The reconciliation is only as good as the webhook trust.

6. **"The 1.5% facilitation fee in transactions.js is too low" assumption**: 1.5% may be intentionally low because the platform expects volume discounts from Paystack, or because the real revenue is from verification fees and subscriptions, not from the escrow facilitation fee. The 1.5% may be a loss leader to drive transaction volume.

### Conclusion

The 5% facilitation fee recommendation is defensible but not certain. The strongest counter-argument is that the 30/30/40 split in transactions.js may be the intended model and the escrow.js full-transfer release may be the bug (not applying the split), not the feature. Resolving this requires asking the founder or the engineer who wrote transactions.js whether the split was intentional and why it was never wired to the live escrow flow.

If the 30/30/40 split is intentional, the commission model needs to be re-derived from that split, not replaced with 5%.
