// Contact details (email, phone, whatsappId) and passwordHash must never
// reach anyone other than the user themselves or a STUDIO_ADMIN.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const usersRouter = require("../src/routes/users");
const createEscrowRouter = require("../src/routes/escrow");
const authRouter = require("../src/routes/auth");

const FULL_USER = {
  id: 3,
  name: "Ada",
  email: "ada@example.com",
  phone: "+2348000000000",
  whatsappId: "2348000000000",
  passwordHash: "$2a$hash",
  role: "LANDLORD",
  isVerified: true,
  isHNW: true,
  hnwVerifiedAt: "2026-09-01T00:00:00.000Z",
  truthIndex: 80,
  avatarUrl: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const CONTACT = ["email", "phone", "whatsappId", "passwordHash"];

function token(user) {
  return `Bearer ${jwt.sign(user, process.env.JWT_SECRET)}`;
}

// Mimics Prisma: with `select`, only the selected scalars come back.
function userPrisma(seen) {
  return {
    user: {
      findUnique: async (args) => {
        seen.args = args;
        if (!args.select) return { ...FULL_USER };
        const out = {};
        for (const [k, v] of Object.entries(args.select)) if (v && k in FULL_USER) out[k] = FULL_USER[k];
        return out;
      },
    },
  };
}

async function call(router, mount, path, { method = "GET", headers = {}, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use(mount, router);
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, text: await res.text() };
  } finally {
    server.close();
  }
}

test("GET /api/users/:id hides contact details from anonymous callers", async () => {
  const seen = {};
  const res = await call(usersRouter(userPrisma(seen)), "/api/users", "/api/users/3?include=passkeys");
  assert.equal(res.status, 200);
  assert.ok(seen.args.select, "public profile must use an explicit select");
  const data = JSON.parse(res.text).data;
  for (const key of [...CONTACT, "isHNW", "hnwVerifiedAt", "_count"]) {
    assert.equal(key in data, false, `${key} must not be public`);
  }
  assert.deepEqual(Object.keys(data).sort(), ["avatarUrl", "createdAt", "id", "isVerified", "name", "role", "truthIndex"]);
});

test("GET /api/users/:id hides contact details from another signed-in user", async () => {
  const seen = {};
  const res = await call(usersRouter(userPrisma(seen)), "/api/users", "/api/users/3", {
    headers: { Authorization: token({ id: 99, role: "USER" }) },
  });
  assert.equal(res.status, 200);
  for (const key of CONTACT) assert.equal(res.text.includes(`"${key}"`), false);
});

test("GET /api/users/:id returns the full record (minus passwordHash) to the user and to admins", async () => {
  for (const viewer of [{ id: 3, role: "LANDLORD" }, { id: 1, role: "STUDIO_ADMIN" }]) {
    const res = await call(usersRouter(userPrisma({})), "/api/users", "/api/users/3", {
      headers: { Authorization: token(viewer) },
    });
    const data = JSON.parse(res.text).data;
    assert.equal(res.status, 200);
    assert.equal(data.email, FULL_USER.email);
    assert.equal("passwordHash" in data, false);
  }
});

test("GET /api/users/:id ignores an invalid token and serves the public profile", async () => {
  const res = await call(usersRouter(userPrisma({})), "/api/users", "/api/users/3", {
    headers: { Authorization: "Bearer not-a-jwt" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.text.includes("ada@example.com"), false);
});

test("GET /api/escrow/:id is limited to the tenant, the landlord and admins", async () => {
  const tx = {
    id: "tx1", tenantId: 5, landlordId: 6,
    tenant: { id: 5, name: "T", email: "t@example.com" },
    landlord: { id: 6, name: "L", email: "l@example.com" },
  };
  const prisma = { escrowTransaction: { findUnique: async () => tx } };
  const router = createEscrowRouter(prisma, {});
  const stranger = await call(router, "/api/escrow", "/api/escrow/tx1", { headers: { Authorization: token({ id: 7, role: "USER" }) } });
  assert.equal(stranger.status, 403);
  assert.equal(stranger.text.includes("@example.com"), false);
  for (const viewer of [{ id: 5, role: "USER" }, { id: 6, role: "LANDLORD" }, { id: 1, role: "STUDIO_ADMIN" }]) {
    const ok = await call(router, "/api/escrow", "/api/escrow/tx1", { headers: { Authorization: token(viewer) } });
    assert.equal(ok.status, 200);
  }
});

test("passkey registration requires sign-in and only for your own account", async () => {
  let touched = false;
  const prisma = new Proxy({}, { get: () => new Proxy({}, { get: () => async () => { touched = true; return null; } }) });
  const router = authRouter(prisma);
  for (const path of ["/api/auth/passkey/register/options", "/api/auth/passkey/register/verify"]) {
    const anon = await call(router, "/api/auth", path, { method: "POST", body: { userId: 3, credential: {} } });
    assert.equal(anon.status, 401, `${path} anonymous`);
    const other = await call(router, "/api/auth", path, {
      method: "POST",
      headers: { Authorization: token({ id: 99, role: "USER" }) },
      body: { userId: 3, credential: {} },
    });
    assert.equal(other.status, 403, `${path} other user`);
    assert.equal(other.text.includes("@"), false);
  }
  assert.equal(touched, false, "the database must not be queried for someone else's account");
});
