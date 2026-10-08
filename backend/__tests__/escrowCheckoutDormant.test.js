const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const createEscrowRouter = require("../src/routes/escrow");

const ENV = ["JWT_SECRET", "PAYSTACK_SECRET_KEY", "PAYSTACK_ENABLED"];
let saved;

beforeEach(() => {
  saved = {};
  for (const key of ENV) saved[key] = process.env[key];
  process.env.JWT_SECRET = "test-secret";
  process.env.PAYSTACK_SECRET_KEY = "sk_test_should_not_charge";
  delete process.env.PAYSTACK_ENABLED;
});

afterEach(() => {
  for (const key of ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("escrow initiate does not call Paystack or create a row when checkout is shelved", async () => {
  const calls = { created: 0, init: 0 };
  const prisma = {
    escrowTransaction: {
      create: async () => {
        calls.created += 1;
        return { id: "esc1" };
      },
    },
  };
  const paystack = {
    initializePayment: async () => {
      calls.init += 1;
      throw new Error("Paystack must stay dormant");
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api/escrow", createEscrowRouter(prisma, paystack));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const token = jwt.sign({ id: 1, role: "USER" }, process.env.JWT_SECRET);
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/escrow/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ landlordId: 2, amount: 1000, currency: "NGN", tenantEmail: "t@example.com" }),
    });
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.code, "PAYSTACK_UNAVAILABLE");
    assert.equal(calls.created, 0);
    assert.equal(calls.init, 0);
  } finally {
    server.close();
  }
});
