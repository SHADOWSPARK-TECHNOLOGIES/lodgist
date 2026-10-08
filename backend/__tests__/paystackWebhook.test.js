// Paystack signs the raw webhook body with HMAC-SHA512 and the secret key.
// A SHA-256 digest, a tampered body, a missing header, or an unset secret
// must be rejected before any event is stored or applied.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const express = require("express");
const createPaymentsRouter = require("../src/routes/payments");

const TEST_SECRET = "sk_test_phase_d_webhook_only";

function sign(raw, algorithm, secret = TEST_SECRET) {
  return crypto.createHmac(algorithm, secret).update(raw).digest("hex");
}

function recorder() {
  const ops = [];
  const seen = new Set();
  return {
    ops,
    processedWebhookEvent: {
      create: async ({ data }) => {
        ops.push(`idempotency:${data.id}`);
        if (seen.has(data.id)) {
          const error = new Error("duplicate");
          error.code = "P2002";
          throw error;
        }
        seen.add(data.id);
        return data;
      },
    },
    escrowTransaction: {
      findFirst: async () => {
        ops.push("escrow.find");
        return { id: "esc1", status: "PENDING", paystackAuthorizationUrl: null };
      },
      update: async () => {
        ops.push("escrow.update");
        return {};
      },
    },
    booking: {
      findFirst: async () => {
        ops.push("booking.find");
        return null;
      },
      update: async () => {
        ops.push("booking.update");
        return {};
      },
    },
  };
}

function updates(prisma) {
  return prisma.ops.filter((op) => op.endsWith(".update")).length;
}

async function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function post(server, raw, headers) {
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: raw,
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const charge = {
  event: "charge.success",
  data: { id: 4242, reference: "LODG-ESC-PHASE-D", amount: 10000, currency: "NGN" },
};

test("Paystack webhook accepts HMAC-SHA512 of the raw body and rejects the rest", async () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
  const prisma = recorder();
  const app = express();
  app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use("/api/payments", createPaymentsRouter(prisma));
  const server = await listen(app);

  try {
    const raw = JSON.stringify(charge);
    const sha512 = sign(raw, "sha512");

    const accepted = await post(server, raw, { "x-paystack-signature": sha512 });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.status, "ok");
    assert.equal(updates(prisma), 1);
    assert.ok(prisma.ops.includes("idempotency:4242"));

    const duplicate = await post(server, raw, { "x-paystack-signature": sha512 });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.message, "Already processed");
    assert.equal(updates(prisma), 1);

    const beforeRejects = prisma.ops.length;

    const sha256 = await post(server, raw, { "x-paystack-signature": sign(raw, "sha256") });
    assert.equal(sha256.status, 401);
    assert.equal(prisma.ops.length, beforeRejects);

    const tampered = raw.replace("10000", "10001");
    const tamperedRes = await post(server, tampered, { "x-paystack-signature": sha512 });
    assert.equal(tamperedRes.status, 401);
    assert.equal(prisma.ops.length, beforeRejects);

    const missing = await post(server, raw, {});
    assert.equal(missing.status, 401);
    assert.equal(missing.body.message, "Missing signature");
    assert.equal(prisma.ops.length, beforeRejects);

    delete process.env.PAYSTACK_SECRET_KEY;
    const unset = await post(server, raw, { "x-paystack-signature": sha512 });
    assert.equal(unset.status, 401);
    assert.equal(unset.body.message, "Unauthorized");
    assert.equal(prisma.ops.length, beforeRejects);
    assert.equal(updates(prisma), 1);
  } finally {
    server.close();
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  }
});

test("a JSON-parsed body is rejected even when the original bytes were signed", async () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
  const prisma = recorder();
  const app = express();
  app.use(express.json());
  app.use("/api/payments", createPaymentsRouter(prisma));
  const server = await listen(app);

  try {
    const raw = JSON.stringify(charge);
    const res = await post(server, raw, { "x-paystack-signature": sign(raw, "sha512") });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Raw body required");
    assert.equal(prisma.ops.length, 0);
  } finally {
    server.close();
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  }
});

test("a retry without data.id is deduped by event and reference", async () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
  const prisma = recorder();
  const app = express();
  app.use(express.raw({ type: "application/json" }));
  app.use("/api/payments", createPaymentsRouter(prisma));
  const server = await listen(app);

  try {
    const raw = JSON.stringify({
      event: "charge.success",
      data: { reference: "LODG-ESC-NO-ID", amount: 10000 },
    });
    const headers = { "x-paystack-signature": sign(raw, "sha512") };
    const first = await post(server, raw, headers);
    assert.equal(first.status, 200);
    assert.equal(updates(prisma), 1);
    assert.ok(prisma.ops.includes("idempotency:charge.success:LODG-ESC-NO-ID"));

    const second = await post(server, raw, headers);
    assert.equal(second.body.message, "Already processed");
    assert.equal(updates(prisma), 1);

    const anonymous = JSON.stringify({ event: "charge.success", data: { amount: 10000 } });
    const rejected = await post(server, anonymous, {
      "x-paystack-signature": sign(anonymous, "sha512"),
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.message, "Event is not idempotent");
    assert.equal(updates(prisma), 1);
  } finally {
    server.close();
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  }
});
