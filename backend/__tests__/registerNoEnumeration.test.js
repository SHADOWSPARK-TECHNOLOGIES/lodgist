// Sec Review spec: /api/auth/register must not reveal whether an email exists.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const bcrypt = require("bcryptjs");
const authRouter = require("../src/routes/auth");

const GENERIC = "We couldn't create that account. If you already have one, sign in instead.";
const FORBIDDEN = /already registered|exists|taken/i;

function listen(prisma) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter(prisma));
  return new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
}

async function register(server, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function spyHash(t) {
  const calls = [];
  const original = bcrypt.hash;
  bcrypt.hash = async (...args) => { calls.push(args); return "hashed"; };
  t.after(() => { bcrypt.hash = original; });
  return calls;
}

const valid = { email: "someone@example.test", password: "long-enough", name: "Someone" };

test("a duplicate email and a P2002 race return the same generic 400", async (t) => {
  const calls = spyHash(t);
  const duplicate = await listen({ user: { findUnique: async () => ({ id: 1, email: valid.email }), create: async () => assert.fail("must not create") } });
  const race = await listen({
    user: {
      findUnique: async () => null,
      create: async () => { throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" }); },
    },
  });
  try {
    const a = await register(duplicate, valid);
    const b = await register(race, valid);
    assert.equal(a.status, 400);
    assert.deepEqual(a, b);
    assert.deepEqual(a.body, { success: false, error: GENERIC });
    // bcrypt ran on both paths with the real cost factor.
    assert.equal(calls.length, 2);
    for (const [pw, cost] of calls) {
      assert.equal(pw, valid.password);
      assert.equal(cost, 12);
    }
  } finally {
    duplicate.close();
    race.close();
  }
});

test("hash runs on the duplicate path before any response", async (t) => {
  const calls = spyHash(t);
  const server = await listen({ user: { findUnique: async () => ({ id: 1 }) } });
  try {
    await register(server, valid);
    assert.equal(calls.length, 1);
  } finally {
    server.close();
  }
});

test("no register response body reveals that an email exists", async (t) => {
  spyHash(t);
  const cases = [
    { prisma: { user: { findUnique: async () => ({ id: 1 }) } }, body: valid },
    { prisma: { user: { findUnique: async () => null, create: async () => { throw Object.assign(new Error("x"), { code: "P2002" }); } } }, body: valid },
    { prisma: { user: { findUnique: async () => null, create: async () => { throw new Error("db down"); } } }, body: valid },
    { prisma: { user: {} }, body: { email: "bad", password: "long-enough", name: "N" } },
    { prisma: { user: {} }, body: { email: valid.email, password: "short", name: "N" } },
    { prisma: { user: {} }, body: {} },
  ];
  for (const { prisma, body } of cases) {
    const server = await listen(prisma);
    try {
      const res = await register(server, body);
      assert.doesNotMatch(JSON.stringify(res.body), FORBIDDEN, JSON.stringify(res.body));
      assert.notEqual(res.status, 409);
    } finally {
      server.close();
    }
  }
});

test("a new email still registers (201) after hashing once", async (t) => {
  const calls = spyHash(t);
  const server = await listen({
    user: { findUnique: async () => null, create: async ({ data }) => ({ id: 5, role: "USER", isHNW: false, ...data }) },
  });
  try {
    const res = await register(server, valid);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(calls.length, 1);
  } finally {
    server.close();
  }
});

test("the auth rate limiter is still mounted in front of /api/auth (incl. /register)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "index.js"), "utf8");
  assert.match(src, /app\.use\("\/api\/auth", authLimiter, authRouter\)/);
  assert.match(src, /const authLimiter = rateLimit\(\{[\s\S]*?max: 20/);
});
