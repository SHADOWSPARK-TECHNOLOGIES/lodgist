const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const advertiserLeadsRouter = require("../src/routes/advertiserLeads");
const {
  validateAdvertiserLead,
  ADVERTISER_SAVED_MESSAGE,
} = require("../src/routes/advertiserLeads");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

function buildApp(prisma) {
  const app = express();
  app.use(express.json());
  app.use("/api/advertiser-leads", advertiserLeadsRouter(prisma));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const validBody = {
  name: "Chioma Okonkwo",
  phone: "08031234567",
  area: "FUTO / Owerri",
  propertyCount: 4,
  notes: "Hostel rooms near campus gate",
  email: "chioma@example.com",
};

test("validateAdvertiserLead rejects a short name and a bad phone", () => {
  const missing = validateAdvertiserLead({ ...validBody, phone: "123" });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes("phone"));

  const name = validateAdvertiserLead({ ...validBody, name: "A" });
  assert.equal(name.ok, false);
  assert.ok(name.errors.includes("name"));

  const empty = validateAdvertiserLead({});
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.includes("name"));
  assert.ok(empty.errors.includes("phone"));
  assert.ok(empty.errors.includes("area"));
});

test("POST /api/advertiser-leads rejects invalid input and does not write", async () => {
  let created = false;
  const prisma = {
    advertiserLead: {
      create: async () => {
        created = true;
        return { id: 1 };
      },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Chioma" }),
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

test("POST /api/advertiser-leads saves interest without promising verification", async () => {
  let saved;
  const prisma = {
    advertiserLead: {
      create: async ({ data }) => {
        saved = data;
        return { id: 7, ...data };
      },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, email: "" }),
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.message, ADVERTISER_SAVED_MESSAGE);
    assert.equal(body.data.id, 7);
    assert.equal(saved.name, "Chioma Okonkwo");
    assert.equal(saved.area, "FUTO / Owerri");
    assert.equal(saved.propertyCount, 4);
    assert.equal(saved.email, null);
    const lower = JSON.stringify(body).toLowerCase();
    assert.equal(lower.includes("verification badge"), true);
    assert.equal(lower.includes("does not verify"), true);
    assert.equal(lower.includes("listing created"), false);
  } finally {
    server.close();
  }
});

test("GET /api/advertiser-leads is unauthorized without a token", async () => {
  let read = false;
  const prisma = {
    advertiserLead: {
      findMany: async () => {
        read = true;
        return [];
      },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`);
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.equal(read, false);
  } finally {
    server.close();
  }
});

test("GET /api/advertiser-leads rejects a signed-in landlord", async () => {
  const token = jwt.sign(
    { id: 9, email: "landlord@example.com", name: "Emeka", role: "LANDLORD" },
    process.env.JWT_SECRET
  );
  const prisma = { advertiserLead: { findMany: async () => [] } };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});
