const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const createBookingsRouter = require("../src/routes/bookings");

const ENV = ["JWT_SECRET"];
let saved;

beforeEach(() => {
  saved = {};
  for (const key of ENV) saved[key] = process.env[key];
  process.env.JWT_SECRET = "test-secret";
});

afterEach(() => {
  for (const key of ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function memoryPrisma(booking) {
  const rows = new Map([[booking.id, { ...booking }]]);
  return {
    rows,
    booking: {
      findUnique: async ({ where }) => {
        const row = rows.get(where.id);
        return row ? { ...row } : null;
      },
      update: async ({ where, data }) => {
        const current = rows.get(where.id);
        const next = { ...current, ...data };
        rows.set(where.id, next);
        return { ...next };
      },
    },
  };
}

function token(user) {
  return jwt.sign(user, process.env.JWT_SECRET);
}

async function listen(prisma) {
  const app = express();
  app.use(express.json());
  app.use("/api/bookings", createBookingsRouter(prisma));
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function send(server, path, { method, user, body }) {
  const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { Authorization: `Bearer ${token(user)}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const tenant = { id: 7, email: "ada@example.com", name: "Ada", role: "USER" };
const admin = { id: 1, email: "reviewer@example.com", name: "Reviewer", role: "STUDIO_ADMIN" };

test("Paystack booking checkout is gone and the WhatsApp manual review confirms", async () => {
  const booking = {
    id: "bk_whatsapp_1",
    tenantId: 7,
    listingId: 3,
    status: "PENDING",
    manualPaymentRef: null,
    totalAmount: 800000,
    currency: "NGN",
  };
  const prisma = memoryPrisma(booking);
  const server = await listen(prisma);
  try {
    const port = server.address().port;
    const closed = await fetch(`http://127.0.0.1:${port}/api/bookings/bk_whatsapp_1/initiate-payment`, { method: "POST" });
    assert.equal(closed.status, 404);
    assert.equal(prisma.rows.get(booking.id).status, "PENDING");
    assert.equal(prisma.rows.get(booking.id).manualPaymentRef, null);

    const queued = await send(server, "/api/bookings/bk_whatsapp_1/manual-payment", {
      method: "PATCH",
      user: tenant,
      body: { manualPaymentRef: "WHATSAPP bk_whatsapp_1" },
    });
    assert.equal(queued.status, 200);
    assert.equal(queued.body.booking.status, "PENDING_VERIFICATION");
    assert.equal(queued.body.booking.manualPaymentRef, "WHATSAPP bk_whatsapp_1");

    const again = await send(server, "/api/bookings/bk_whatsapp_1/manual-payment", {
      method: "PATCH",
      user: tenant,
      body: { manualPaymentRef: "WHATSAPP bk_whatsapp_1" },
    });
    assert.equal(again.status, 409);
    assert.equal(prisma.rows.get(booking.id).status, "PENDING_VERIFICATION");

    const confirmed = await send(server, "/api/bookings/bk_whatsapp_1/verify-payment", {
      method: "PATCH",
      user: admin,
      body: { action: "approve", adminNotes: "Seen on WhatsApp" },
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.booking.status, "CONFIRMED");
    assert.equal(confirmed.body.booking.manualPaymentRef, "WHATSAPP bk_whatsapp_1");
  } finally {
    server.close();
  }
});
