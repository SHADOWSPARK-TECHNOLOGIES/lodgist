// Escrow routes (src/routes/escrow.js): auth + liveness gate, PENDING → HELD →
// RELEASED, LODG-ESC- references, Paystack balance check, 5% commission and
// party-scoped reads. Prisma and Paystack are plain in-memory fakes.
// This file exercises the shelved Paystack path with the flag explicitly on.
process.env.PAYSTACK_ENABLED = "true";
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_mocked_secret_key";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const createEscrowRouter = require("../src/routes/escrow");

const TENANT = { id: 1, role: "USER" };
const LANDLORD = { id: 2, role: "LANDLORD" };
const auth = (u) => ({ Authorization: `Bearer ${jwt.sign(u, process.env.JWT_SECRET)}` });

const HELD_TX = {
  id: "esc1", reference: "LODG-ESC-1712345678901-abc", tenantId: 1, landlordId: 2,
  listingId: 10, amount: 100000, currency: "NGN", status: "HELD", description: "Rent",
};
const BANK = { name: "Landlord", accountNumber: "0123456789", bankCode: "058" };

function fakes({ tx = HELD_TX, verifyStatus = "success", balances = [{ currency: "NGN", balance: 1_000_000 }], balanceError, initError } = {}) {
  const calls = { created: [], updated: [], init: [], transfers: [], findMany: [] };
  const prisma = {
    escrowTransaction: {
      create: async ({ data }) => { calls.created.push(data); return { id: "esc1", ...data }; },
      update: async (args) => { calls.updated.push(args); return { ...tx, ...args.data }; },
      findFirst: async () => (tx ? { ...tx } : null),
      findUnique: async () => (tx ? { ...tx } : null),
      findMany: async (args) => { calls.findMany.push(args); return []; },
    },
  };
  const paystack = {
    initializePayment: async (args) => {
      calls.init.push(args);
      if (initError) throw new Error(initError);
      return { authorization_url: "https://checkout.paystack.com/x", reference: args.reference };
    },
    verifyPayment: async (reference) => ({ status: verifyStatus, reference, amount: 100000, currency: "NGN", paidAt: "2026-09-28T00:00:00Z", channel: "card" }),
    getBalance: async () => { if (balanceError) throw new Error("down"); return balances; },
    createTransferRecipient: async () => ({ recipientCode: "RCP_1" }),
    transferToLandlord: async (args) => { calls.transfers.push(args); return { transferCode: "TRF_1", status: "success", amount: args.amount }; },
  };
  return { prisma, paystack, calls };
}

async function call(f, path, { method = "GET", headers = {}, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/escrow", createEscrowRouter(f.prisma, f.paystack));
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}
const post = (f, path, user, body) => call(f, path, { method: "POST", headers: user ? auth(user) : {}, body });

test("every escrow route requires a bearer token", async () => {
  const f = fakes();
  for (const [method, path] of [["POST", "/api/escrow/initiate"], ["POST", "/api/escrow/hold"], ["POST", "/api/escrow/release"], ["GET", "/api/escrow/esc1"], ["GET", "/api/escrow"]]) {
    const res = await call(f, path, { method, body: method === "POST" ? {} : undefined });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

test("POST /initiate validates input and gates HNW amounts behind liveness", async () => {
  const f = fakes();
  assert.equal((await post(f, "/api/escrow/initiate", TENANT, { landlordId: 2, currency: "NGN" })).status, 400, "amount missing");
  let res = await post(f, "/api/escrow/initiate", TENANT, { amount: 1000, currency: "NGN" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Missing required fields/);
  res = await post(f, "/api/escrow/initiate", TENANT, { landlordId: 2, amount: 1000, currency: "NGN" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /tenantEmail/);

  res = await post(f, "/api/escrow/initiate", TENANT, { landlordId: 2, amount: 10_000_000, currency: "NGN", tenantEmail: "t@example.com" });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "LIVENESS_REQUIRED");
  assert.equal(f.calls.created.length, 0);

  res = await post(f, "/api/escrow/initiate", { ...TENANT, isHNW: true }, { landlordId: 2, amount: 10_000_000, currency: "NGN", tenantEmail: "t@example.com" });
  assert.equal(res.status, 200, "verified HNW users pass the gate");
});

test("POST /initiate creates a PENDING LODG-ESC- transaction for the signed-in tenant", async () => {
  const f = fakes();
  const res = await post(f, "/api/escrow/initiate", TENANT, { tenantId: 99, landlordId: 2, listingId: 10, amount: 100000, currency: "NGN", tenantEmail: "t@example.com" });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.escrowTransactionId, "esc1");
  assert.equal(res.body.paymentAuthorizationUrl, "https://checkout.paystack.com/x");

  const data = f.calls.created[0];
  assert.equal(data.tenantId, 1, "tenantId comes from the token, not the body");
  assert.equal(data.status, "PENDING");
  assert.match(data.reference, /^LODG-ESC-\d+-[a-z0-9]+$/);

  const init = f.calls.init[0];
  assert.equal(init.email, "t@example.com");
  assert.equal(init.reference, data.reference);
  assert.equal(init.idempotencyKey, "escrow-init-esc1");
  assert.deepEqual(f.calls.updated[0], {
    where: { id: "esc1" },
    data: { paystackAuthorizationUrl: "https://checkout.paystack.com/x", paystackReference: data.reference },
  });
});

test("POST /initiate returns 500 when Paystack fails", async () => {
  const f = fakes({ initError: "Paystack API error" });
  const res = await post(f, "/api/escrow/initiate", TENANT, { landlordId: 2, amount: 1000, currency: "NGN", tenantEmail: "t@example.com" });
  assert.equal(res.status, 500);
  assert.equal(res.body.error, "Paystack API error");
});

test("POST /hold verifies with Paystack and moves PENDING to HELD", async () => {
  assert.equal((await post(fakes(), "/api/escrow/hold", TENANT, {})).status, 400);

  let res = await post(fakes({ verifyStatus: "failed" }), "/api/escrow/hold", TENANT, { reference: "LODG-ESC-x" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /not successful/);

  assert.equal((await post(fakes({ tx: null }), "/api/escrow/hold", TENANT, { reference: "LODG-ESC-x" })).status, 404);

  res = await post(fakes({ tx: { ...HELD_TX, status: "RELEASED" } }), "/api/escrow/hold", TENANT, { reference: "LODG-ESC-x" });
  assert.equal(res.status, 409);

  const f = fakes({ tx: { ...HELD_TX, status: "PENDING" } });
  res = await post(f, "/api/escrow/hold", TENANT, { reference: HELD_TX.reference });
  assert.equal(res.status, 200);
  assert.match(res.body.message, /held in escrow/);
  assert.deepEqual(f.calls.updated[0], { where: { id: "esc1" }, data: { paystackReference: HELD_TX.reference, status: "HELD" } });
});

test("POST /release: only the landlord, only from HELD", async () => {
  assert.equal((await post(fakes(), "/api/escrow/release", LANDLORD, {})).status, 400);
  assert.equal((await post(fakes({ tx: null }), "/api/escrow/release", LANDLORD, { escrowTransactionId: "esc1", landlordBankDetails: BANK })).status, 404);

  let f = fakes();
  let res = await post(f, "/api/escrow/release", { id: 999, role: "LANDLORD" }, { escrowTransactionId: "esc1", landlordId: 2, landlordBankDetails: BANK });
  assert.equal(res.status, 403, "landlordId in the body is ignored");
  assert.equal(f.calls.transfers.length, 0);

  res = await post(fakes({ tx: { ...HELD_TX, status: "PENDING" } }), "/api/escrow/release", LANDLORD, { escrowTransactionId: "esc1", landlordBankDetails: BANK });
  assert.equal(res.status, 409);
});

test("POST /release checks the Paystack balance first", async () => {
  for (const [opts, status, code] of [
    [{ balances: [] }, 402, "INSUFFICIENT_BALANCE"],
    [{ balances: [{ currency: "NGN", balance: 50000 }] }, 402, "INSUFFICIENT_BALANCE"],
    [{ balanceError: true }, 503, "BALANCE_CHECK_UNAVAILABLE"],
  ]) {
    const f = fakes(opts);
    const res = await post(f, "/api/escrow/release", LANDLORD, { escrowTransactionId: "esc1", landlordBankDetails: BANK });
    assert.equal(res.status, status);
    assert.equal(res.body.code, code);
    assert.equal(f.calls.transfers.length, 0);
    assert.equal(f.calls.updated.length, 0);
  }
  const res = await post(fakes(), "/api/escrow/release", LANDLORD, { escrowTransactionId: "esc1" });
  assert.equal(res.status, 400, "bank details required");
});

test("POST /release transfers the amount minus 5% commission and marks RELEASED", async () => {
  const f = fakes();
  const res = await post(f, "/api/escrow/release", LANDLORD, { escrowTransactionId: "esc1", landlordBankDetails: BANK });
  assert.equal(res.status, 200);
  assert.equal(res.body.amountReleased, 95000);
  const transfer = f.calls.transfers[0];
  assert.equal(transfer.amount, 95000);
  assert.equal(transfer.recipientCode, "RCP_1");
  assert.match(transfer.reference, /^LODG-REL-1712345678901-abc-\d+$/);
  const { where, data } = f.calls.updated[0];
  assert.deepEqual(where, { id: "esc1" });
  assert.equal(data.status, "RELEASED");
  assert.equal(data.commissionAmount, 5000);
  assert.ok(data.releaseDate instanceof Date);
});

test("GET /api/escrow lists only the caller's own transactions", async () => {
  const f = fakes();
  const res = await call(f, "/api/escrow?status=HELD", { headers: auth(TENANT) });
  assert.equal(res.status, 200);
  assert.deepEqual(f.calls.findMany[0].where, { OR: [{ tenantId: 1 }, { landlordId: 1 }], status: "HELD" });
});

test("GET /api/escrow/:id returns 404 for an unknown transaction", async () => {
  const res = await call(fakes({ tx: null }), "/api/escrow/nope", { headers: auth(TENANT) });
  assert.equal(res.status, 404);
});
