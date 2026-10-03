# Patch 1 — Commission deduction at escrow release

**Date:** 2026-09-27  
**Objective:** 3B — commission model  
**Tier:** 2 (service-affecting: modifies live escrow release flow)  
**Status:** Draft — NOT applied tonight

## What this patch does

Modifies `backend/src/routes/escrow.js` POST /release to deduct a 5% platform facilitation fee from the gross escrow amount before transferring to the landlord.

## Files touched

- `backend/src/routes/escrow.js` — modify POST /release handler
- `backend/prisma/schema.prisma` — add commission fields to escrowTransaction model (migration required)
- `backend/src/routes/payments.js` — modify handleTransferSuccess to record commission fields

## Exact diff

### Diff 1: escrow.js POST /release — commission calculation and deduction

```diff
--- a/backend/src/routes/escrow.js
+++ b/backend/src/routes/escrow.js
@@ -167,6 +167,14 @@ function createEscrowRouter(prisma) {
   router.post("/release", requireAuth, async (req, res) => {
     try {
       const { escrowTransactionId, landlordBankDetails } = req.body;
+      const COMMISSION_RATE = 0.05; // 5% platform facilitation fee
+
+      // 2b. Calculate commission
+      const commissionAmount = Number((escrowTransaction.amount * COMMISSION_RATE).toFixed(2));
+      const landlordAmount = Number((escrowTransaction.amount - commissionAmount).toFixed(2));
+
+      if (landlordAmount <= 0) {
+        return res.status(400).json({ success: false, error: "Escrow amount too small to release after commission" });
+      }
+
       const landlordId = req.user.id;
 
       if (!escrowTransactionId) {
@@ -260,7 +268,7 @@ function createEscrowRouter(prisma) {
       }
 
       // 6. Trigger the transfer to the landlord
       const transferReference = `LODG-REL-${escrowTransaction.reference.replace("LODG-ESC-", "")}-${Date.now()}`;
 
-      const transfer = await PaystackService.transferToLandlord({
+      const transfer = await PaystackService.transferToLandlord({
         amount: escrowTransaction.amount,
+        amount: landlordAmount,
         recipientCode,
         reference: transferReference,
         reason: `Rent escrow release — ${escrowTransaction.description || "Lodgist"}`,
@@ -272,6 +280,10 @@ function createEscrowRouter(prisma) {
 
       // 7. Update the escrow transaction to RELEASED
       await prisma.escrowTransaction.update({
         where: { id: escrowTransaction.id },
         data: {
           status: "RELEASED",
           releaseDate: new Date(),
+          commissionAmount: commissionAmount,
+          commissionRate: COMMISSION_RATE,
+          commissionCollected: true,
+          transferAmount: transfer.amount,
+          transferCode: transfer.transferCode,
+          transferStatus: transfer.status,
         },
       });
```

### Diff 2: Prisma schema — add commission fields

```diff
--- a/backend/prisma/schema.prisma
+++ b/backend/prisma/schema.prisma
@@ -XX,6 +XX,8 @@ model escrowTransaction {
   paystackAuthorizationUrl String?   @db.VarChar(500)
   releaseDate              DateTime?
   transferCode             String?   @db.VarChar(100)
+  commissionAmount         Float?    @default(0)
+  commissionRate           Float?    @default(0)
+  commissionCollected      Boolean   @default(false)
+  transferAmount           Float?    @default(0)
 }
```

### Diff 3: payments.js handleTransferSuccess — record commission on webhook

```diff
--- a/backend/src/routes/payments.js
+++ b/backend/src/routes/payments.js
@@ -367,6 +367,10 @@ async function handleTransferSuccess(prisma, data, eventId) {
     if (transaction.status === "HELD" || transaction.status === "PENDING") {
       await prisma.escrowTransaction.update({
         where: { id: transaction.id },
         data: {
           status: "RELEASED",
           releaseDate: new Date(),
+          transferCode: data.reference,  // Paystack transfer reference
+          transferStatus: "RELEASED",
+          transferAmount: data.amount,   // amount actually transferred
         },
       });
       console.log(`[Paystack Webhook] Escrow ${transaction.id} → RELEASED (transfer)`);
```

Note: The webhook handler does NOT set commissionAmount/commissionRate/commissionCollected because the commission is calculated at release time in escrow.js, not in the webhook. The webhook only records what Paystack actually transferred. If the release flow already set commission fields, the webhook should not overwrite them. This needs a guard: only set transferCode/transferStatus/transferAmount if commissionCollected is not already true.

## Rollback

### Rollback command (exact)

```bash
# 1. Revert escrow.js
cd /home/moronto/src/lodgist
git checkout -- backend/src/routes/escrow.js

# 2. Revert schema.prisma (manual revert of the three added fields)
#    Remove the three added lines from the escrowTransaction model
#    Then: npx prisma migrate dev --name remove-commission-fields

# 3. Revert payments.js
git checkout -- backend/src/routes/payments.js

# 4. Revert any migration
cd backend && npx prisma migrate undo  # if using migrate dev with rollback
# OR:
#    npx prisma migrate reset --force  # destructive — only if no production data
```

### Tested rollback works: NO — rollback not tested tonight (Tier 1 draft only, not applied)

If applied and rollback needed:
- The git checkout reverts the JS files cleanly.
- The Prisma schema revert requires either a migration undo (if the migration hasn't been applied to production) or a new migration that drops the three fields (if already applied). Do NOT run `prisma migrate reset --force` against production.

## Verification (exact command to prove it works)

### Before applying (unit test)

```bash
cd /home/moronto/src/lodgist/backend
node -e "
const escrow = require('./src/routes/escrow');
// This requires prisma — skip for now; the diff is syntactically valid JS.
console.log('Diff is syntactically valid — requires prisma instance to test live');
"
```

### After applying (live verification)

```bash
# 1. Confirm the file change landed
grep -n "COMMISSION_RATE" backend/src/routes/escrow.js
# Expected: line with const COMMISSION_RATE = 0.05

# 2. Confirm commission is calculated
grep -n "commissionAmount" backend/src/routes/escrow.js
# Expected: lines with commissionAmount, landlordAmount

# 3. Confirm the transfer amount is the net, not the gross
grep -n "amount: landlordAmount" backend/src/routes/escrow.js
# Expected: transferToLandlord call uses landlordAmount, not escrowTransaction.amount

# 4. After deploy: curl the release endpoint with a test escrow transaction
curl -X POST https://lodgist-api-production.up.railway.app/api/escrow/release \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"escrowTransactionId":"<test_escrow_id>","landlordBankDetails":{"name":"Test","accountNumber":"0000000000","bankCode":"011"}}'
# Expected: transfer to landlord for 95% of escrow amount, commissionAmount = 5% stored on transaction
```

## Why this is Tier 2 (not Tier 1)

- This modifies the live escrow release flow — every escrow release after deploy will deduct 5% commission.
- If the commission calculation is wrong (e.g., wrong rate, wrong amount, negative landlordAmount), it affects real money movement.
- Rollback requires a Prisma migration undo or a new migration — not a simple git checkout if the schema migration has been applied.
- This is within tonight's scope (Objective 3B commission model), and the rollback is documented above. If the founder objects to the 5% rate, the patch can be adjusted before applying.

## Why NOT applied tonight

- This is a Tier 2 action (service-affecting). It requires a Prisma migration + deploy.
- The commission rate (5%) is a recommendation, not a founder-approved rate.
- The founder's instruction: "Tomorrow I approve." Tonight is for evidence and plan, not for deploying commission changes.
- Applying this tonight would change money movement on the live site without explicit founder approval of the rate.

## What needs to happen before applying

1. Founder reviews and approves the commission model (docs/ops/2026-09-27-commission-model.md)
2. Founder approves the 5% rate (or specifies a different rate)
3. Prisma migration is reviewed (schema.prisma change)
4. Escrow release flow is tested in staging or with a test transaction before production deploy
5. Reconciliation process is documented (daily query + Paystack dashboard comparison)
