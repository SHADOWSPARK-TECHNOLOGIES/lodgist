// A successful Paystack charge confirms a booking or escrow payment.
// It must not write a listing review or a verified badge.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const express = require("express");
const createPaymentsRouter = require("../src/routes/payments");

function sign(raw, secret) {
  return crypto.createHmac("sha512", secret).update(raw).digest("hex");
}

function prismaRecorder() {
  const writes = [];
  return {
    writes,
    processedWebhookEvent: { create: async () => ({ id: "evt" }) },
    escrowTransaction: {
      findFirst: async () => ({ id: "esc1", status: "PENDING", paystackAuthorizationUrl: null }),
      update: async ({ data }) => {
        writes.push({ model: "escrow", data });
        return data;
      },
    },
    booking: {
      findFirst: async () => ({ id: "bk1", status: "PENDING", paystackReference: null }),
      update: async ({ data }) => {
        writes.push({ model: "booking", data });
        return data;
      },
    },
    listing: {
      update: async () => {
        throw new Error("payment must not update a listing");
      },
    },
  };
}

async function postWebhook(prisma, event) {
  const raw = JSON.stringify(event);
  const secret = "sk_test_badge";
  process.env.PAYSTACK_SECRET_KEY = secret;
  const app = express();
  app.use(express.raw({ type: "application/json" }));
  app.use("/api/payments", createPaymentsRouter(prisma));
  const server = await new Promise((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": sign(raw, secret),
      },
      body: raw,
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

function assertNoVerifiedBadge(writes) {
  for (const write of writes) {
    assert.notEqual(write.model, "listing");
    assert.equal(write.data.reviewStatus, undefined);
    assert.equal(write.data.riskState, undefined);
    assert.notEqual(write.data.status, "VERIFIED");
  }
}

test("charge.success on escrow does not buy a verified listing badge", async () => {
  const prisma = prismaRecorder();
  const res = await postWebhook(prisma, {
    event: "charge.success",
    data: { id: 9001, reference: "LODG-ESC-1", authorization: {} },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(prisma.writes.length, 1);
  assert.equal(prisma.writes[0].model, "escrow");
  assert.equal(prisma.writes[0].data.status, "HELD");
  assertNoVerifiedBadge(prisma.writes);
});

test("charge.success on a booking does not buy a verified listing badge", async () => {
  const prisma = prismaRecorder();
  const res = await postWebhook(prisma, {
    event: "charge.success",
    data: { id: 9002, reference: "LODG-ESC-BK-1", metadata: { type: "booking_payment", bookingId: "bk1" } },
  });
  assert.equal(res.status, 200);
  assert.equal(prisma.writes.length, 1);
  assert.equal(prisma.writes[0].model, "booking");
  assert.equal(prisma.writes[0].data.status, "CONFIRMED");
  assertNoVerifiedBadge(prisma.writes);
});
