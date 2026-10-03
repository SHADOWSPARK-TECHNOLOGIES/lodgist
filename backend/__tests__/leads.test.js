const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const leadsRouter = require("../src/routes/leads");
const { validateLead, LEAD_SAVED_MESSAGE } = require("../src/routes/leads");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

function buildApp(prisma) {
  const app = express();
  app.use(express.json());
  app.use("/api/leads", leadsRouter(prisma));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const validBody = {
  location: "Owerri",
  budget: 800000,
  bedrooms: 2,
  moveInTimeframe: "Within 1 month",
  phone: "08031234567",
  email: "ada@example.com",
};

test("validateLead rejects a missing phone and a bad email", () => {
  const missing = validateLead({ ...validBody, phone: "123" });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes("phone"));

  const email = validateLead({ ...validBody, email: "not-an-email" });
  assert.equal(email.ok, false);
  assert.ok(email.errors.includes("email"));

  const empty = validateLead({});
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.includes("location"));
  assert.ok(empty.errors.includes("budget"));
  assert.ok(empty.errors.includes("bedrooms"));
  assert.ok(empty.errors.includes("moveInTimeframe"));
});

test("POST /api/leads rejects invalid input and does not write", async () => {
  let created = false;
  const prisma = { lead: { create: async () => { created = true; return { id: 1 }; } } };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "Owerri" }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.equal(created, false);
    assert.ok(body.fields.includes("phone"));
  } finally {
    server.close();
  }
});

test("POST /api/leads saves a request without promising a specific home", async () => {
  let saved;
  const prisma = {
    lead: {
      create: async ({ data }) => {
        saved = data;
        return { id: 4, ...data };
      },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, email: "" }),
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.message, LEAD_SAVED_MESSAGE);
    assert.equal(body.data.id, 4);
    assert.equal(saved.location, "Owerri");
    assert.equal(saved.budget, 800000);
    assert.equal(saved.bedrooms, 2);
    assert.equal(saved.email, null);
    assert.equal(JSON.stringify(body).toLowerCase().includes("matched"), false);
    assert.equal(JSON.stringify(body).toLowerCase().includes("payment completed"), false);
  } finally {
    server.close();
  }
});

test("GET /api/leads is unauthorized without a token", async () => {
  let read = false;
  const prisma = { lead: { findMany: async () => { read = true; return []; } } };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/leads`);
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.equal(read, false);
  } finally {
    server.close();
  }
});

test("GET /api/leads rejects a signed-in renter", async () => {
  const token = jwt.sign(
    { id: 3, email: "ada@example.com", name: "Ada", role: "TENANT" },
    process.env.JWT_SECRET
  );
  const prisma = { lead: { findMany: async () => [] } };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/leads`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});
