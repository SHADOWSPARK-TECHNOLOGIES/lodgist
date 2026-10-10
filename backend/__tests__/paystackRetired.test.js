// Paystack checkout was retired on 8 Oct 2026 (PR #64): payments are arranged
// on WhatsApp and confirmed by staff. The Paystack initiate, verify, release
// and webhook paths are gone; escrow history stays readable.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");
const createEscrowRouter = require("../src/routes/escrow");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

test("escrow initiate, hold and release are gone; history reads still work", async () => {
  const row = { id: "esc1", tenantId: 7, landlordId: 8, status: "HELD", paystackReference: "LODG-ESC-OLD" };
  const prisma = {
    escrowTransaction: {
      findUnique: async () => ({ ...row, tenant: { id: 7 }, landlord: { id: 8 }, listing: null }),
      findMany: async () => [row],
      count: async () => 1,
      create: async () => assert.fail("must not create escrow rows"),
      update: async () => assert.fail("must not update escrow rows"),
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api/escrow", createEscrowRouter(prisma));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const token = jwt.sign({ id: 7, email: "t@example.com", name: "T", role: "USER" }, process.env.JWT_SECRET);
  const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/escrow`;
    for (const p of ["/initiate", "/hold", "/release"]) {
      const res = await fetch(base + p, { method: "POST", headers, body: "{}" });
      assert.equal(res.status, 404, p);
    }
    const one = await fetch(base + "/esc1", { headers });
    assert.equal(one.status, 200);
  } finally {
    server.close();
  }
});

test("the API no longer mounts a Paystack webhook or loads a Paystack client", () => {
  const index = fs.readFileSync(path.join(__dirname, "../src/index.js"), "utf8");
  assert.equal(index.includes("/api/payments"), false);
  assert.equal(/paystack/i.test(index), false);
  assert.equal(fs.existsSync(path.join(__dirname, "../src/services/paystackService.js")), false);
  assert.equal(fs.existsSync(path.join(__dirname, "../src/routes/payments.js")), false);
});
